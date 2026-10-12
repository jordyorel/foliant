-- Run in the isolated workflow QA database after the base SQL fixture.
\set ON_ERROR_STOP on
\i docs/supabase_workspace_workflow_management.sql
\i docs/supabase_workspace_workflow_management.sql
begin;
do $$
declare total integer;
begin
  update public.workspace_workflows set enabled=false,archived_at=now()
    where id='10000000-0000-0000-0000-000000000001';
  select count(*) into total from public.create_workspace_workflow(
    '00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000099',
    'Replacement',null,null,'reviewer@example.test');
  if total <> 1 then raise exception 'Archive did not free rule slot'; end if;
  select count(*) into total from public.create_workspace_workflow(
    '00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000098',
    'Over limit',null,null,'reviewer@example.test');
  if total <> 0 then raise exception 'Rule limit weakened'; end if;
  if (select count(*) from public.workspace_workflow_runs where workflow_id='10000000-0000-0000-0000-000000000001') <> 1
    then raise exception 'Archived rule lost run history'; end if;
  begin
    update public.workspace_workflows set enabled=true where id='10000000-0000-0000-0000-000000000001';
    raise exception 'Archived rule was reactivated';
  exception when check_violation then null;
  end;
  if has_function_privilege('authenticated','public.create_workspace_workflow(uuid,uuid,text,text,bigint,text)','EXECUTE')
    then raise exception 'Unsafe RPC grant'; end if;
  if has_table_privilege('authenticated','public.workspace_workflows','UPDATE')
    then raise exception 'Unsafe direct rule update'; end if;
end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
do $$ begin
  if (select count(*) from public.workspace_workflows) <> 0 then raise exception 'Archived rule leaked'; end if;
  if (select count(*) from public.workspace_workflow_runs) <> 0 then raise exception 'History leaked'; end if;
end $$;
reset role;
rollback;
select 'Workflow management SQL QA passed' as result;
