-- Videotool web app schema.
-- Run once in the Supabase SQL Editor (Project xgmuzuxtezefhblezque), or via
-- an authenticated Supabase MCP session once `claude /mcp` has been run.

create extension if not exists pgcrypto;

create table if not exists public.projects (
  id                 uuid primary key default gen_random_uuid(),
  slug               text not null unique
                       check (slug ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  name               text not null,
  owner_id           uuid not null default auth.uid()
                       references auth.users(id) on delete cascade,
  video_filename     text,
  video_storage_path text,
  video_size_bytes   bigint,
  video_uploaded_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists projects_set_updated_at on public.projects;
create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

alter table public.projects enable row level security;

drop policy if exists "owner_full_access" on public.projects;
create policy "owner_full_access"
  on public.projects
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Private bucket for raw video uploads. Object path convention enforced by
-- the policies below: <owner_id>/<slug>/<filename>.
insert into storage.buckets (id, name, public)
values ('videos', 'videos', false)
on conflict (id) do nothing;

drop policy if exists "videos_owner_select" on storage.objects;
create policy "videos_owner_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "videos_owner_insert" on storage.objects;
create policy "videos_owner_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "videos_owner_update" on storage.objects;
create policy "videos_owner_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "videos_owner_delete" on storage.objects;
create policy "videos_owner_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'videos' and (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- Automatischer Video-Bearbeitungs-Worker (Phase 1: transkribieren -> schneiden
-- -> Checkpoint -> rendern). Der lokale Worker (worker/) nutzt den
-- service_role-Key und umgeht damit RLS -- die Policies unten gelten fuer
-- Zugriffe aus der Web-App (anon/authenticated).
-- ============================================================================

create type public.job_status as enum
  ('queued', 'claimed', 'running', 'awaiting_approval', 'done', 'failed', 'cancelled');
create type public.checkpoint_status as enum
  ('pending', 'approved', 'rejected', 'edited');
create type public.checkpoint_type as enum
  ('cut_plan', 'self_eval');  -- workflow_branch/brand_choice/storyboard kommen in Phase 2

create table if not exists public.jobs (
  id                 uuid primary key default gen_random_uuid(),
  project_id         uuid not null references public.projects(id) on delete cascade,
  owner_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  status             job_status not null default 'queued',
  phase              text,
  claude_session_id  text,
  worker_pid         text,
  claimed_at         timestamptz,
  started_at         timestamptz,
  finished_at        timestamptz,
  error_message      text,
  cost_usd_estimate  numeric,
  result_summary_de  text,
  result_video_path  text,          -- lokaler Pfad relativ zum Projekt-Root (Phase 1)
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.job_checkpoints (
  id                uuid primary key default gen_random_uuid(),
  job_id            uuid not null references public.jobs(id) on delete cascade,
  owner_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  seq               int not null,
  type              checkpoint_type not null,
  status            checkpoint_status not null default 'pending',
  title_de          text not null,
  summary_de        text not null,
  payload           jsonb not null default '{}',
  decision_payload  jsonb,
  tool_use_id       text,
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);

drop trigger if exists jobs_set_updated_at on public.jobs;
create trigger jobs_set_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

alter table public.jobs enable row level security;
alter table public.job_checkpoints enable row level security;

drop policy if exists "owner_full_access" on public.jobs;
create policy "owner_full_access"
  on public.jobs
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop policy if exists "owner_full_access" on public.job_checkpoints;
create policy "owner_full_access"
  on public.job_checkpoints
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- Atomarer Job-Claim fuer den Worker (service_role, umgeht RLS ohnehin --
-- for update skip locked schuetzt trotzdem gegen zwei gleichzeitige Worker).
create or replace function public.claim_next_job(worker_pid_param text)
returns public.jobs
language plpgsql
as $$
declare
  claimed public.jobs;
begin
  update public.jobs
  set status = 'claimed', claimed_at = now(), worker_pid = worker_pid_param
  where id = (
    select id from public.jobs
    where status = 'queued'
    order by created_at asc
    limit 1
    for update skip locked
  )
  returning * into claimed;

  return claimed;
end;
$$;

-- ============================================================================
-- Cloudflare R2 als Speicher fuer neue (grosse) Video-Uploads. Bestehende
-- Uploads bleiben in video_storage_path (Supabase Storage) -- beide Spalten
-- laufen parallel, welche gesetzt ist entscheidet den Speicherort. R2 kennt
-- kein auth.uid()/RLS -- die Zugriffskontrolle passiert serverseitig in den
-- Server Actions (web/app/projects/r2Actions.ts), die vor jedem Presigned-URL
-- pruefen, dass ein Nutzer eingeloggt ist.
-- ============================================================================

alter table public.projects add column if not exists video_r2_key text;

-- ============================================================================
-- Mehrere Dateien pro Projekt (2026-09-08). Die alten Einzel-Datei-Spalten auf
-- projects (video_filename/video_storage_path/video_r2_key/...) bleiben
-- unangetastet fuer die Historie -- neuer Code liest/schreibt nur noch
-- project_assets. Migration unten uebernimmt bestehende Einzel-Dateien als
-- ersten Asset-Eintrag, damit nichts verloren geht.
-- ============================================================================

create table if not exists public.project_assets (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  owner_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  filename         text not null,
  storage_backend  text not null check (storage_backend in ('supabase', 'r2')),
  storage_path     text,   -- gesetzt wenn storage_backend = 'supabase'
  r2_key           text,   -- gesetzt wenn storage_backend = 'r2'
  size_bytes       bigint,
  uploaded_at      timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

alter table public.project_assets enable row level security;

drop policy if exists "owner_full_access" on public.project_assets;
create policy "owner_full_access"
  on public.project_assets
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ============================================================================
-- Dauer/Format fuer die "Fertige Videos"-Tabelle (2026-09-10). Client liest
-- diese Werte beim Upload aus dem HTMLVideoElement/HTMLImageElement aus und
-- schickt sie mit -- kein serverseitiges ffprobe fuer den Upload-Pfad noetig.
-- Nullable, weil bereits hochgeladene Alt-Assets diese Werte nicht haben.
-- ============================================================================

alter table public.project_assets add column if not exists duration_seconds double precision;
alter table public.project_assets add column if not exists width int;
alter table public.project_assets add column if not exists height int;

-- ============================================================================
-- Brand-Frame-Definitionen (2026-09-10) -- ein Markdown-Dokument pro Brand
-- (nach dem "frame.md" fuer Hyperframes), das Farben/Schriften/Design-Regeln
-- im selben CSS-Custom-Property-Stil traegt wie brand-guidelines/default/*.md
-- im Repo. Web-App speichert/zeigt es nur -- der lokale Worker/Hyperframes-
-- Prozess liest weiterhin aus brand-guidelines/ auf der Platte, das hier ist
-- kein Ersatz dafuer, sondern der bequeme Ablage-/Vorschau-Ort in der UI.
-- Ein einzelner Nutzer, "name" haelt trotzdem die Tuer fuer mehrere Brands offen.
-- ============================================================================

create table if not exists public.brand_frames (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name        text not null default 'default',
  content     text not null default '',
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  unique (owner_id, name)
);

alter table public.brand_frames enable row level security;

drop policy if exists "owner_full_access" on public.brand_frames;
create policy "owner_full_access"
  on public.brand_frames
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

drop trigger if exists brand_frames_set_updated_at on public.brand_frames;
create trigger brand_frames_set_updated_at before update on public.brand_frames
  for each row execute function public.set_updated_at();

-- Einmalige Migration: bestehende Einzel-Datei pro Projekt als ersten Asset
-- uebernehmen. "where not exists" macht das Skript sicher mehrfach ausfuehrbar.
insert into public.project_assets
  (project_id, owner_id, filename, storage_backend, storage_path, r2_key, size_bytes, uploaded_at)
select
  p.id, p.owner_id, p.video_filename,
  case when p.video_r2_key is not null then 'r2' else 'supabase' end,
  p.video_storage_path, p.video_r2_key, p.video_size_bytes,
  coalesce(p.video_uploaded_at, p.created_at)
from public.projects p
where p.video_filename is not null
  and not exists (
    select 1 from public.project_assets a
    where a.project_id = p.id and a.filename = p.video_filename
  );

-- ============================================================================
-- Musikbibliothek pro Nutzer + Musikauswahl pro Projekt (2026-09-10).
-- Tracks sind global (ein Nutzer, eine gemeinsame Bibliothek), nicht an ein
-- einzelnes Projekt gebunden -- jedes Projekt waehlt daraus genau einen aus.
-- ============================================================================

create table if not exists public.music_tracks (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  filename          text not null,
  storage_backend   text not null check (storage_backend in ('supabase', 'r2')),
  storage_path      text,   -- gesetzt wenn storage_backend = 'supabase'
  r2_key            text,   -- gesetzt wenn storage_backend = 'r2'
  duration_seconds  double precision,
  size_bytes        bigint,
  uploaded_at       timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

alter table public.music_tracks enable row level security;

drop policy if exists "owner_full_access" on public.music_tracks;
create policy "owner_full_access"
  on public.music_tracks
  for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

alter table public.projects add column if not exists music_track_id uuid
  references public.music_tracks(id) on delete set null;

-- Eigener, vollstaendiger Auftrag statt des generierten Standard-Prompts
-- (2026-09-10) -- Freitext-Feld auf der Projektseite, ersetzt buildInitialPrompt
-- komplett, wenn gesetzt. Siehe worker/src/jobLoop.ts::tryClaimAndStartJob.
alter table public.jobs add column if not exists custom_prompt text;

-- Projekt-spezifische Brand-Auswahl (2026-09-10) -- brand_frames traegt jetzt
-- mehrere benannte Brands (nicht nur "default"), Projekte waehlen eine davon.
alter table public.projects add column if not exists brand_frame_id uuid
  references public.brand_frames(id) on delete set null;
