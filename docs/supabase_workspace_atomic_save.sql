-- Apply after supabase_workspace_workflow_queue.sql. No historical document is replayed.
begin;
create or replace function public.save_workspace_document(p_document jsonb)
returns setof public.workspace_documents
language plpgsql security definer set search_path = '' as $$
declare
  doc public.workspace_documents;
  existing public.workspace_documents;
begin
  doc := jsonb_populate_record(null::public.workspace_documents,p_document);
  if doc.user_id is null or doc.id !~ '^doc_[a-f0-9-]{36}$'
    or doc.source_job_id is null or doc.result_size<0 then raise exception 'invalid_request'; end if;
  perform pg_advisory_xact_lock(hashtextextended('save:'||doc.user_id::text||':'||doc.source_job_id,0));
  select * into existing from public.workspace_documents
    where user_id=doc.user_id and source_job_id=doc.source_job_id order by created_at,id limit 1;
  if found then
    -- Retrying a confirmed save returns its document, never replays rules against old files.
    return next existing;
    return;
  end if;
  insert into public.workspace_documents select (doc).*;
  insert into public.workspace_document_versions(id,document_id,source_job_id,version_number,kind_tool,result_object_key,result_file_name,result_mime_type,result_size,page_count,created_at)
    values('version_'||doc.id||'_1',doc.id,doc.source_job_id,1,doc.kind_tool,doc.result_object_key,doc.result_file_name,doc.result_mime_type,doc.result_size,doc.page_count,doc.created_at);
  perform public.enqueue_workspace_workflows(doc.user_id,doc.id);
  return next doc;
end;
$$;
revoke all on function public.save_workspace_document(jsonb) from public,anon,authenticated;
grant execute on function public.save_workspace_document(jsonb) to service_role;
commit;
