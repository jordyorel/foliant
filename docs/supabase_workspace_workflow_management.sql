-- Apply after supabase_workspace_workflows.sql. Keeps rules, runs and approvals.
begin;
alter table public.workspace_workflows add column if not exists archived_at timestamptz;
alter table public.workspace_workflows add column if not exists updated_at timestamptz;
alter table public.workspace_workflows drop constraint if exists workspace_workflows_archive_disabled;
alter table public.workspace_workflows add constraint workspace_workflows_archive_disabled
  check (archived_at is null or enabled = false);
create or replace function public.create_workspace_workflow(p_user_id uuid, p_id uuid, p_name text, p_tool text, p_max_bytes bigint, p_recipient_email text)
returns setof public.workspace_workflows
language plpgsql security definer set search_path = public, pg_temp as $$
declare recipient uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('workflow:' || p_user_id::text, 0));
  if (select count(*) from public.workspace_workflows where user_id = p_user_id and archived_at is null) >= 5 then return; end if;
  recipient := public.resolve_workspace_approver(lower(trim(p_recipient_email)));
  if recipient is null or recipient = p_user_id then raise exception 'recipient_unavailable'; end if;
  return query insert into public.workspace_workflows(id,user_id,name,tool,max_bytes,recipient_email)
    values(p_id,p_user_id,trim(p_name),p_tool,p_max_bytes,lower(trim(p_recipient_email))) returning *;
end;
$$;
revoke all on function public.create_workspace_workflow(uuid,uuid,text,text,bigint,text) from public, anon, authenticated;
grant execute on function public.create_workspace_workflow(uuid,uuid,text,text,bigint,text) to service_role;
commit;
