-- Apply after the workspace versions, activity and approvals migrations.
-- Applied to the Foliant Supabase project on 2026-10-10 through Safari SQL Editor.
begin;
create table if not exists public.workspace_workflows (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  enabled boolean not null default true,
  tool text,
  max_bytes bigint check (max_bytes between 1 and 1000000000),
  recipient_email text not null check (char_length(recipient_email) between 3 and 254),
  created_at timestamptz not null default now()
);
create table if not exists public.workspace_workflow_runs (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  workflow_id uuid not null references public.workspace_workflows(id),
  workflow_name text not null,
  document_id text not null,
  document_name text not null,
  version_id text not null,
  status text not null check (status in ('running','succeeded','failed','skipped')),
  reason text check (reason in ('approval_requested','conditions_not_met','recipient_unavailable','conflict','unavailable')),
  approval_id uuid,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (workflow_id, document_id)
);
create index if not exists workspace_workflows_owner on public.workspace_workflows(user_id, created_at desc);
create index if not exists workspace_workflow_runs_owner on public.workspace_workflow_runs(user_id, created_at desc);
alter table public.workspace_workflows enable row level security;
alter table public.workspace_workflow_runs enable row level security;
drop policy if exists workflows_owner_read on public.workspace_workflows;
create policy workflows_owner_read on public.workspace_workflows for select to authenticated using (user_id = auth.uid());
drop policy if exists workflow_runs_owner_read on public.workspace_workflow_runs;
create policy workflow_runs_owner_read on public.workspace_workflow_runs for select to authenticated using (user_id = auth.uid());
revoke all on public.workspace_workflows, public.workspace_workflow_runs from anon, authenticated;
grant select on public.workspace_workflows, public.workspace_workflow_runs to authenticated;
grant all on public.workspace_workflows, public.workspace_workflow_runs to service_role;

create or replace function public.create_workspace_workflow(p_user_id uuid, p_id uuid, p_name text, p_tool text, p_max_bytes bigint, p_recipient_email text)
returns setof public.workspace_workflows
language plpgsql security definer set search_path = public, pg_temp as $$
declare recipient uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('workflow:' || p_user_id::text, 0));
  if (select count(*) from public.workspace_workflows where user_id = p_user_id) >= 5 then return; end if;
  recipient := public.resolve_workspace_approver(lower(trim(p_recipient_email)));
  if recipient is null or recipient = p_user_id then raise exception 'recipient_unavailable'; end if;
  return query insert into public.workspace_workflows(id,user_id,name,tool,max_bytes,recipient_email)
    values(p_id,p_user_id,trim(p_name),p_tool,p_max_bytes,lower(trim(p_recipient_email))) returning *;
end;
$$;
revoke all on function public.create_workspace_workflow(uuid,uuid,text,text,bigint,text) from public, anon, authenticated;
grant execute on function public.create_workspace_workflow(uuid,uuid,text,text,bigint,text) to service_role;
commit;
