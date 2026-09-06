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
