-- Run after workflow-queue.sql in the disposable local QA database.
\set ON_ERROR_STOP on
\i docs/supabase_workspace_atomic_save.sql
\i docs/supabase_workspace_atomic_save.sql
begin;
update public.workspace_workflows set enabled=true,archived_at=null,updated_at=null;
create function public.qa_fail_enqueue() returns trigger language plpgsql as $$begin raise exception 'Simulated enqueue failure'; end$$;
create trigger qa_enqueue_failure before insert on public.workspace_workflow_runs for each row execute function public.qa_fail_enqueue();
do $$
declare payload jsonb := '{"id":"doc_77777777-7777-4777-8777-777777777777","user_id":"00000000-0000-0000-0000-000000000001","source_job_id":"atomic_save_job","name":"neutral.pdf","kind_tool":"rotate_pdf","result_object_key":"qa/neutral.pdf","result_file_name":"neutral.pdf","result_mime_type":"application/pdf","result_size":500}';
begin
 payload := payload||jsonb_build_object('created_at',now(),'updated_at',now());
 begin
  perform public.save_workspace_document(payload);
  raise exception 'Enqueue fault not reached';
 exception when raise_exception then if sqlerrm<>'Simulated enqueue failure' then raise; end if; end;
 if exists(select 1 from public.workspace_documents where source_job_id='atomic_save_job') then raise exception 'Document survived enqueue rollback'; end if;
 if exists(select 1 from public.workspace_document_versions where source_job_id='atomic_save_job') then raise exception 'V1 survived enqueue rollback'; end if;
end$$;
drop trigger qa_enqueue_failure on public.workspace_workflow_runs;
do $$
declare
 payload jsonb := '{"id":"doc_77777777-7777-4777-8777-777777777777","user_id":"00000000-0000-0000-0000-000000000001","source_job_id":"atomic_save_job","name":"neutral.pdf","kind_tool":"rotate_pdf","result_object_key":"qa/neutral.pdf","result_file_name":"neutral.pdf","result_mime_type":"application/pdf","result_size":500}';
 saved public.workspace_documents;
begin
 payload := payload||jsonb_build_object('created_at',now(),'updated_at',now());
 select * into saved from public.save_workspace_document(payload);
 if saved.id<>'doc_77777777-7777-4777-8777-777777777777' then raise exception 'Wrong save'; end if;
 select * into saved from public.save_workspace_document(payload||'{"id":"doc_88888888-8888-4888-8888-888888888888"}');
 if saved.id<>'doc_77777777-7777-4777-8777-777777777777' then raise exception 'Retry duplicated document'; end if;
 if (select count(*) from public.workspace_document_versions where source_job_id='atomic_save_job')<>1 then raise exception 'Retry duplicated V1'; end if;
 if (select count(*) from public.workspace_workflow_runs where document_id=saved.id)<>(select count(*) from public.workspace_workflows where enabled) then raise exception 'Queue missing or duplicated'; end if;
 if has_function_privilege('authenticated','public.save_workspace_document(jsonb)','EXECUTE') or has_function_privilege('anon','public.save_workspace_document(jsonb)','EXECUTE') then raise exception 'Public atomic save'; end if;
end$$;
rollback;
select 'Atomic workspace save SQL QA passed' as result;
