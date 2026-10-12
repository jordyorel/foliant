-- Run against a fresh isolated PostgreSQL database with Supabase role fixtures.
\set ON_ERROR_STOP on
create schema auth;
create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
grant usage on schema auth to authenticated;
\i docs/supabase_workspace_schema.sql
\i docs/supabase_workspace_ownership.sql
\i docs/supabase_workspace_activity.sql
\i docs/supabase_workspace_approvals.sql
\i docs/supabase_workspace_workflows.sql
\i docs/supabase_workspace_workflow_management.sql
\i docs/supabase_workspace_workflow_queue.sql
\i docs/supabase_workspace_workflow_queue.sql
insert into auth.users values
 ('00000000-0000-0000-0000-000000000001','owner@example.test',now()),
 ('00000000-0000-0000-0000-000000000002','reviewer@example.test',now());
insert into public.workspace_workflows(id,user_id,name,recipient_email,created_at)
 values('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','Queue QA','reviewer@example.test',now()-interval '1 day');
insert into public.workspace_documents(id,user_id,source_job_id,name,kind_tool,result_object_key,result_file_name,result_mime_type,result_size)
 select 'doc_'||i,'00000000-0000-0000-0000-000000000001','job_'||i,'neutral.pdf','rotate_pdf','unused','neutral.pdf','application/pdf',50 from generate_series(1,6) i;
insert into public.workspace_document_versions(id,document_id,source_job_id,version_number,kind_tool,result_object_key,result_file_name,result_mime_type,result_size)
 select 'v_'||i,'doc_'||i,'job_'||i,1,'rotate_pdf','unused','neutral.pdf','application/pdf',50 from generate_series(1,6) i;
do $$begin
 if public.enqueue_workspace_workflows('00000000-0000-0000-0000-000000000001','doc_1')<>1 then raise exception 'Enqueue failed'; end if;
 if public.enqueue_workspace_workflows('00000000-0000-0000-0000-000000000001','doc_1')<>0 then raise exception 'Duplicate enqueue'; end if;
 begin
  perform public.enqueue_workspace_workflows('00000000-0000-0000-0000-000000000002','doc_1');
  raise exception 'Wrong owner accepted';
 exception when raise_exception then if sqlerrm<>'not_found' then raise; end if; end;
 if public.process_workspace_workflows('00000000-0000-0000-0000-000000000002',5)<>0 then raise exception 'Wrong owner executed'; end if;
end$$;
create function public.fail_queue_journal() returns trigger language plpgsql as $$begin raise exception 'Simulated journal failure'; end$$;
create trigger queue_failure before update on public.workspace_workflow_runs for each row execute function public.fail_queue_journal();
do $$begin
 begin
  perform public.process_workspace_workflows(null,5);
  raise exception 'Fault did not occur';
 exception when raise_exception then if sqlerrm<>'Simulated journal failure' then raise; end if; end;
 if (select count(*) from public.workspace_approvals)<>0 then raise exception 'Approval survived rolled-back journal'; end if;
 if (select count(*) from public.workspace_activity)<>0 then raise exception 'Activity survived rolled-back journal'; end if;
 if (select status from public.workspace_workflow_runs where document_id='doc_1')<>'running' then raise exception 'Queue not retained'; end if;
end$$;
drop trigger queue_failure on public.workspace_workflow_runs;
do $$begin
 if public.process_workspace_workflows(null,5)<>1 then raise exception 'Recovery failed'; end if;
 if public.process_workspace_workflows(null,5)<>0 then raise exception 'Duplicate processing'; end if;
 if (select count(*) from public.workspace_approvals)<>1 then raise exception 'Duplicate approval'; end if;
 if (select count(*) from public.workspace_activity)<>1 then raise exception 'Duplicate activity'; end if;
 if not exists(select 1 from public.workspace_workflow_runs r join public.workspace_approvals a on a.id=r.approval_id where r.status='succeeded' and a.version_id='v_1') then raise exception 'Unpinned approval'; end if;
end$$;
-- Pauses, edits and archives revoke unprocessed work. Legacy interrupted entries stay untouched.
select public.enqueue_workspace_workflows('00000000-0000-0000-0000-000000000001','doc_2');
update public.workspace_workflows set enabled=false;
select public.process_workspace_workflows(null,5);
update public.workspace_workflows set enabled=true;
select public.enqueue_workspace_workflows('00000000-0000-0000-0000-000000000001','doc_3');
update public.workspace_workflows set updated_at=now();
select public.process_workspace_workflows(null,5);
update public.workspace_workflows set updated_at=null;
select public.enqueue_workspace_workflows('00000000-0000-0000-0000-000000000001','doc_4');
update public.workspace_workflows set enabled=false,archived_at=now();
select public.process_workspace_workflows(null,5);
insert into public.workspace_workflow_runs(id,user_id,workflow_id,workflow_name,document_id,document_name,version_id,status)
 values(gen_random_uuid(),'00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','Legacy','doc_5','neutral.pdf','v_5','running');
do $$begin
 if public.process_workspace_workflows(null,5)<>0 then raise exception 'Legacy run replayed'; end if;
 if (select count(*) from public.workspace_workflow_runs where status='skipped')<>3 then raise exception 'Revoked work shared'; end if;
 if (select count(*) from public.workspace_approvals)<>1 then raise exception 'Unwanted sharing'; end if;
 if has_function_privilege('authenticated','public.process_workspace_workflows(uuid,integer)','EXECUTE') or has_function_privilege('anon','public.enqueue_workspace_workflows(uuid,text)','EXECUTE') then raise exception 'Public queue RPC'; end if;
end$$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',false);
do $$begin
 if (select count(*) from public.workspace_workflow_runs)<>0 then raise exception 'Cross-owner queue leak'; end if;
end$$;
reset role;
select 'Workflow queue SQL QA passed' as result;
