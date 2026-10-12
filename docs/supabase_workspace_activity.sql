-- Apply before activating durable activity. No historical events are invented.
create table if not exists public.workspace_activity (
  id uuid primary key,
  sequence bigint generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  document_id text not null,
  job_id text,
  action text not null check (action in ('imported', 'job_created', 'processing_completed', 'processing_failed', 'download_requested', 'saved', 'modified', 'restored', 'deleted')),
  tool text,
  version_number integer check (version_number > 0),
  created_at timestamptz not null default now()
);
-- No document FK: the owner can see the deletion event after deleting a document.
create index if not exists workspace_activity_user_date on public.workspace_activity(user_id, created_at desc, sequence desc);
create index if not exists workspace_activity_document_date on public.workspace_activity(user_id, document_id, created_at desc, sequence desc);
alter table public.workspace_activity enable row level security;
revoke all on public.workspace_activity from anon, authenticated;
grant select on public.workspace_activity to authenticated;
grant all on public.workspace_activity to service_role;
grant usage, select on sequence public.workspace_activity_sequence_seq to service_role;
drop policy if exists "Owner reads activity" on public.workspace_activity;
create policy "Owner reads activity" on public.workspace_activity for select to authenticated using (auth.uid() = user_id);
