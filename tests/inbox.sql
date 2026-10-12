-- Disposable local QA database only, after workflow-queue.sql.
\set ON_ERROR_STOP on
\i docs/supabase_workspace_inbox.sql
\i docs/supabase_workspace_inbox.sql
begin;
update public.workspace_workflows set enabled=false;
update public.workspace_workflows set enabled=true,archived_at=null,updated_at=null,tool=null
  where id='10000000-0000-0000-0000-000000000001';
create function public.qa_inbox_enqueue_fault() returns trigger language plpgsql as $$begin raise exception 'Inbox simulated fault'; end$$;
create trigger qa_inbox_fault before insert on public.workspace_workflow_runs for each row execute function public.qa_inbox_enqueue_fault();
do $$
declare r public.workspace_inbox; retry public.workspace_inbox;
begin
  select * into r from public.reserve_workspace_inbox('00000000-0000-0000-0000-000000000001','22222222-2222-4222-8222-222222222222','neutral.pdf',500,repeat('a',64),1,false);
  select * into retry from public.reserve_workspace_inbox(r.user_id,r.request_id,r.name,r.size,r.sha256,1,false);
  if retry.id<>r.id then raise exception 'Duplicate receipt'; end if;
  begin
    perform public.reserve_workspace_inbox(r.user_id,r.request_id,'different.pdf',r.size,r.sha256,1,false);
    raise exception 'Conflict not detected';
  exception when raise_exception then if sqlerrm<>'conflict' then raise; end if; end;
  select * into r from public.finish_workspace_inbox(r.user_id,r.id);
  perform public.finish_workspace_inbox(r.user_id,r.id);
  if (select count(*) from public.workspace_inbox_events where receipt_id=r.id)<>1 then raise exception 'Duplicate receive event'; end if;
  if exists(select 1 from public.workspace_documents where source_inbox_id=r.id) then raise exception 'Receipt created document early'; end if;
  begin
    perform public.accept_workspace_inbox('00000000-0000-0000-0000-000000000002',r.id);
    raise exception 'Cross-owner accept';
  exception when raise_exception then if sqlerrm<>'not_found' then raise; end if; end;
  begin
    perform public.accept_workspace_inbox(r.user_id,r.id);
    raise exception 'Fault not reached';
  exception when raise_exception then if sqlerrm<>'Inbox simulated fault' then raise; end if; end;
  if exists(select 1 from public.workspace_documents where source_inbox_id=r.id) then raise exception 'Document survived rollback'; end if;
  if exists(select 1 from public.workspace_document_versions where source_inbox_id=r.id) then raise exception 'V1 survived rollback'; end if;
  if (select status from public.workspace_inbox where id=r.id)<>'received' then raise exception 'Receipt changed on failure'; end if;
end$$;
drop trigger qa_inbox_fault on public.workspace_workflow_runs;
do $$
declare r public.workspace_inbox; retry public.workspace_inbox;
begin
  select * into r from public.workspace_inbox where request_id='22222222-2222-4222-8222-222222222222';
  select * into r from public.accept_workspace_inbox(r.user_id,r.id);
  select * into retry from public.accept_workspace_inbox(r.user_id,r.id);
  if retry.document_id<>r.document_id then raise exception 'Duplicate acceptance'; end if;
  if (select count(*) from public.workspace_document_versions where document_id=r.document_id)<>1 then raise exception 'Duplicate version'; end if;
  if not exists(select 1 from public.workspace_documents where id=r.document_id and source_job_id is null and kind_tool='import_pdf' and result_object_key<>r.object_key and result_size=r.size) then raise exception 'Invalid import origin or shared file'; end if;
  if (select count(*) from public.workspace_workflow_runs where document_id=r.document_id)<>1 then raise exception 'Duplicate queue'; end if;
  perform public.archive_workspace_inbox(r.user_id,r.id,true);
  perform public.archive_workspace_inbox(r.user_id,r.id,true);
  select * into retry from public.archive_workspace_inbox(r.user_id,r.id,false);
  if retry.status<>'accepted' or retry.document_id<>r.document_id then raise exception 'Archive lost acceptance'; end if;
  if (select count(*) from public.workspace_inbox_events where receipt_id=r.id)<>4 then raise exception 'Duplicate archive event'; end if;
  delete from public.workspace_documents where id=r.document_id;
  select * into retry from public.accept_workspace_inbox(r.user_id,r.id);
  if retry.document_id is not null or retry.accepted_at is null then raise exception 'Deleted document silently recreated'; end if;
  if has_function_privilege('authenticated','public.accept_workspace_inbox(uuid,uuid)','execute') then raise exception 'Browser write privilege'; end if;
end$$;
do $$
declare r public.workspace_inbox;
begin
  select * into r from public.reserve_workspace_inbox('00000000-0000-0000-0000-000000000001',gen_random_uuid(),'protected.pdf',500,repeat('c',64),null,true);
  perform public.finish_workspace_inbox(r.user_id,r.id);
  select * into r from public.accept_workspace_inbox(r.user_id,r.id);
  if not exists(select 1 from public.workspace_documents where id=r.document_id and protected_pdf and page_count is null)
    then raise exception 'Protected import lost protection or invented page count'; end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000002',true);
do $$begin
  if exists(select 1 from public.workspace_inbox) or exists(select 1 from public.workspace_inbox_events) then raise exception 'Cross-owner RLS leak'; end if;
end$$;
reset role;
-- Includes archived/accepted/pending records: no quota escape through archiving.
insert into public.workspace_inbox(user_id,request_id,name,object_key,size,sha256,page_count,protected_pdf)
select '00000000-0000-0000-0000-000000000002',gen_random_uuid(),'neutral.pdf','qa/'||gen_random_uuid(),1,repeat('a',64),1,false from generate_series(1,200);
do $$begin
  begin
    perform public.reserve_workspace_inbox('00000000-0000-0000-0000-000000000002',gen_random_uuid(),'neutral.pdf',10,repeat('a',64),1,false);
    raise exception 'Quota not enforced';
  exception when raise_exception then if sqlerrm<>'quota_exceeded' then raise; end if; end;
end$$;
rollback;
select 'Inbox SQL QA passed' as result;
