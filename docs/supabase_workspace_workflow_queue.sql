-- Apply after supabase_workspace_workflow_management.sql.
-- Existing inline runs are deliberately excluded from automatic recovery.
begin;
alter table public.workspace_workflow_runs add column if not exists durable boolean not null default false;
alter table public.workspace_workflow_runs add column if not exists rule_revision timestamptz;
create index if not exists workspace_workflow_queue_pending
  on public.workspace_workflow_runs(created_at,id) where durable and status='running';

create or replace function public.enqueue_workspace_workflows(p_user_id uuid,p_document_id text)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  doc public.workspace_documents;
  ver public.workspace_document_versions;
  rule public.workspace_workflows;
  inserted integer := 0;
  affected integer;
begin
  select * into doc from public.workspace_documents where id=p_document_id and user_id=p_user_id for share;
  if not found then raise exception 'not_found'; end if;
  select * into ver from public.workspace_document_versions
    where document_id=doc.id and version_number=1 and id not like 'legacy_%' for share;
  if not found then raise exception 'not_found'; end if;
  for rule in select * from public.workspace_workflows
    where user_id=p_user_id and enabled and archived_at is null
      and coalesce(updated_at,created_at)<=doc.created_at for share
  loop
    insert into public.workspace_workflow_runs(id,user_id,workflow_id,workflow_name,document_id,document_name,version_id,status,durable,rule_revision)
      values(gen_random_uuid(),p_user_id,rule.id,rule.name,doc.id,doc.name,ver.id,'running',true,coalesce(rule.updated_at,rule.created_at))
      on conflict (workflow_id,document_id) do nothing;
    get diagnostics affected = row_count;
    inserted := inserted + affected;
  end loop;
  return inserted;
end;
$$;

-- The approval and terminal journal entry are a single database transaction.
-- Connection loss rolls back both, or commits both; SKIP LOCKED prevents duplicate workers.
create or replace function public.process_workspace_workflows(p_user_id uuid default null,p_limit integer default 5)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  job public.workspace_workflow_runs;
  rule public.workspace_workflows;
  ver public.workspace_document_versions;
  approval public.workspace_approvals;
  outcome text;
  explanation text;
  processed integer := 0;
begin
  for job in select * from public.workspace_workflow_runs
    where durable and status='running' and (p_user_id is null or user_id=p_user_id)
    order by created_at,id limit greatest(1,least(coalesce(p_limit,5),10)) for update skip locked
  loop
    outcome := 'skipped'; explanation := 'conditions_not_met'; approval := null;
    select * into rule from public.workspace_workflows where id=job.workflow_id and user_id=job.user_id for share;
    if found and rule.enabled and rule.archived_at is null
      and coalesce(rule.updated_at,rule.created_at)=job.rule_revision then
      select v.* into ver from public.workspace_document_versions v
        join public.workspace_documents d on d.id=v.document_id
        where v.id=job.version_id and v.document_id=job.document_id and v.version_number=1
          and d.user_id=job.user_id for share of d,v;
      if found and ver.result_mime_type='application/pdf'
        and (rule.tool is null or rule.tool=ver.kind_tool)
        and (rule.max_bytes is null or ver.result_size<=rule.max_bytes) then
        begin
          select * into approval from public.request_workspace_approval(job.id,job.user_id,job.document_id,job.version_id,rule.recipient_email,job.workflow_name);
          if approval.id is null then raise exception 'not_found'; end if;
          insert into public.workspace_activity(id,user_id,document_id,action,version_number)
            values(gen_random_uuid(),job.user_id,job.document_id,'approval_requested',ver.version_number);
          outcome := 'succeeded'; explanation := 'approval_requested';
        exception
          when unique_violation then outcome := 'failed'; explanation := 'conflict'; approval := null;
          when raise_exception then
            if sqlerrm='recipient_unavailable' then outcome := 'failed'; explanation := 'recipient_unavailable'; approval := null;
            elsif sqlerrm='not_found' then outcome := 'skipped'; explanation := 'conditions_not_met'; approval := null;
            else raise; end if;
        end;
      end if;
    end if;
    update public.workspace_workflow_runs set status=outcome,reason=explanation,approval_id=approval.id,finished_at=now() where id=job.id;
    processed := processed+1;
  end loop;
  return processed;
end;
$$;
revoke all on function public.enqueue_workspace_workflows(uuid,text) from public,anon,authenticated;
revoke all on function public.process_workspace_workflows(uuid,integer) from public,anon,authenticated;
grant execute on function public.enqueue_workspace_workflows(uuid,text) to service_role;
grant execute on function public.process_workspace_workflows(uuid,integer) to service_role;
commit;
