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
