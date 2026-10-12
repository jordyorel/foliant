-- Studio 0.8 migration. Applied to the project on 2026-10-06.
-- Run as the project owner in one transaction; safe to reapply.
begin;
create table if not exists public.workspace_approvals (
  id uuid primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  owner_email text not null,
  reviewer_email text not null,
  document_id text not null,
  document_name text not null,
  version_id text not null,
  version_number integer not null check (version_number > 0),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'canceled')),
  note text not null default '' check (length(note) <= 2000),
  comment text not null default '' check (length(comment) <= 2000),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check (owner_id <> reviewer_id),
  check ((status = 'pending' and decided_at is null) or (status <> 'pending' and decided_at is not null))
);
-- Keep the minimal decision history after document deletion; file access still checks the live version.
create index if not exists workspace_approvals_owner_date on public.workspace_approvals(owner_id, created_at desc);
create index if not exists workspace_approvals_reviewer_date on public.workspace_approvals(reviewer_id, created_at desc);
create unique index if not exists workspace_approvals_pending_unique on public.workspace_approvals(document_id, version_id, reviewer_id) where status = 'pending';
alter table public.workspace_approvals enable row level security;
revoke all on public.workspace_approvals from anon, authenticated;
grant select on public.workspace_approvals to authenticated;
grant select, insert, update on public.workspace_approvals to service_role;
drop policy if exists "Participants read approvals" on public.workspace_approvals;
create policy "Participants read approvals" on public.workspace_approvals for select to authenticated using (auth.uid() = owner_id or auth.uid() = reviewer_id);

create or replace function public.resolve_workspace_approver(p_email text) returns uuid
language sql stable security definer set search_path = '' as $$
  select id from auth.users where lower(email) = lower(trim(p_email)) and email_confirmed_at is not null limit 1;
$$;
revoke all on function public.resolve_workspace_approver(text) from public, anon, authenticated;
grant execute on function public.resolve_workspace_approver(text) to service_role;

create or replace function public.request_workspace_approval(p_id uuid, p_owner_id uuid, p_document_id text, p_version_id text, p_recipient_email text, p_note text)
returns setof public.workspace_approvals language plpgsql security definer set search_path = '' as $$
declare
  recipient uuid;
  sender_email text;
  saved_name text;
  saved_version integer;
begin
  select d.name, v.version_number into saved_name, saved_version
    from public.workspace_documents d join public.workspace_document_versions v on v.document_id = d.id
    where d.id = p_document_id and d.user_id = p_owner_id and v.id = p_version_id for share of d, v;
  if not found then raise exception 'not_found'; end if;
  recipient := public.resolve_workspace_approver(p_recipient_email);
  if recipient is null or recipient = p_owner_id then raise exception 'recipient_unavailable'; end if;
  select email into sender_email from auth.users where id = p_owner_id;
  return query insert into public.workspace_approvals(id, owner_id, reviewer_id, owner_email, reviewer_email, document_id, document_name, version_id, version_number, note)
    values (p_id, p_owner_id, recipient, sender_email, lower(trim(p_recipient_email)), p_document_id, saved_name, p_version_id, saved_version, p_note) returning *;
end;
$$;
revoke all on function public.request_workspace_approval(uuid, uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.request_workspace_approval(uuid, uuid, text, text, text, text) to service_role;

alter table public.workspace_activity drop constraint if exists workspace_activity_action_check;
alter table public.workspace_activity add constraint workspace_activity_action_check check (action in ('imported', 'job_created', 'processing_completed', 'processing_failed', 'download_requested', 'saved', 'modified', 'restored', 'deleted', 'approval_requested', 'approval_approved', 'approval_rejected', 'approval_canceled'));
commit;
