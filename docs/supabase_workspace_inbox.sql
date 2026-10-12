-- Apply after supabase_workspace_atomic_save.sql. No existing file is ingested.
begin;
alter table public.workspace_documents alter column source_job_id drop not null;
alter table public.workspace_document_versions alter column source_job_id drop not null;
alter table public.workspace_documents add column if not exists source_inbox_id uuid;
alter table public.workspace_document_versions add column if not exists source_inbox_id uuid;
alter table public.workspace_documents add column if not exists protected_pdf boolean;
alter table public.workspace_document_versions add column if not exists protected_pdf boolean;

create table if not exists public.workspace_inbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  name text not null check (length(name) between 1 and 180),
  object_key text not null unique,
  size bigint not null check (size between 1 and 26214400),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  page_count integer check (page_count > 0),
  protected_pdf boolean not null,
  origin text not null default 'manual' check (origin='manual'),
  status text not null default 'uploading' check (status in ('uploading','received','accepted','archived')),
  document_id text references public.workspace_documents(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  archived_at timestamptz,
  unique(user_id,request_id)
);
create index if not exists workspace_inbox_owner_date on public.workspace_inbox(user_id,created_at desc,id);
alter table public.workspace_inbox alter column page_count drop not null;
create table if not exists public.workspace_inbox_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  receipt_id uuid not null references public.workspace_inbox(id) on delete cascade,
  action text not null check (action in ('received','accepted','archived','restored')),
  created_at timestamptz not null default now()
);
alter table public.workspace_inbox enable row level security;
alter table public.workspace_inbox_events enable row level security;
revoke all on public.workspace_inbox,public.workspace_inbox_events from anon,authenticated;
grant select on public.workspace_inbox,public.workspace_inbox_events to authenticated;
grant all on public.workspace_inbox,public.workspace_inbox_events to service_role;
drop policy if exists inbox_owner_read on public.workspace_inbox;
create policy inbox_owner_read on public.workspace_inbox for select to authenticated
  using(user_id=(select auth.uid()) and status<>'uploading');
drop policy if exists inbox_events_owner_read on public.workspace_inbox_events;
create policy inbox_events_owner_read on public.workspace_inbox_events for select to authenticated
  using(user_id=(select auth.uid()));

create or replace function public.reserve_workspace_inbox(p_user_id uuid,p_request_id uuid,p_name text,p_size bigint,p_sha256 text,p_page_count integer,p_protected boolean)
returns setof public.workspace_inbox language plpgsql security definer set search_path='' as $$
declare r public.workspace_inbox; receipt_id uuid:=gen_random_uuid();
begin
  if p_user_id is null or p_request_id is null or p_name is null or p_size is null
    or p_sha256 is null or p_protected is null or (p_page_count is null and not p_protected)
    then raise exception 'invalid_request'; end if;
  perform pg_advisory_xact_lock(hashtextextended('inbox:'||p_user_id::text,0));
  select * into r from public.workspace_inbox where user_id=p_user_id and request_id=p_request_id;
  if found then
    if r.name<>p_name or r.size<>p_size or r.sha256<>p_sha256 then raise exception 'conflict'; end if;
    return next r; return;
  end if;
  if (select count(*) from public.workspace_inbox where user_id=p_user_id)>=200
    or (select coalesce(sum(size),0) from public.workspace_inbox where user_id=p_user_id)+p_size>262144000
    then raise exception 'quota_exceeded'; end if;
  insert into public.workspace_inbox(id,user_id,request_id,name,object_key,size,sha256,page_count,protected_pdf)
    values(receipt_id,p_user_id,p_request_id,p_name,'inbox/'||p_user_id::text||'/'||receipt_id::text||'.pdf',p_size,p_sha256,p_page_count,p_protected)
    returning * into r;
  return next r;
end;
$$;

create or replace function public.finish_workspace_inbox(p_user_id uuid,p_id uuid)
returns setof public.workspace_inbox language plpgsql security definer set search_path='' as $$
declare r public.workspace_inbox;
begin
  select * into r from public.workspace_inbox where id=p_id and user_id=p_user_id for update;
  if not found then raise exception 'not_found'; end if;
  if r.status='uploading' then
    update public.workspace_inbox set status='received' where id=r.id returning * into r;
    insert into public.workspace_inbox_events(user_id,receipt_id,action) values(p_user_id,r.id,'received');
  end if;
  return next r;
end;
$$;

create or replace function public.accept_workspace_inbox(p_user_id uuid,p_id uuid)
returns setof public.workspace_inbox language plpgsql security definer set search_path='' as $$
declare r public.workspace_inbox; doc_id text; saved_at timestamptz:=clock_timestamp();
begin
  select * into r from public.workspace_inbox where id=p_id and user_id=p_user_id and status<>'uploading' for update;
  if not found then raise exception 'not_found'; end if;
  -- accepted_at also guards retries after a separately deleted workspace document.
  if r.accepted_at is not null then return next r; return; end if;
  if r.status<>'received' then raise exception 'conflict'; end if;
  doc_id:='doc_'||gen_random_uuid()::text;
  insert into public.workspace_documents(user_id,id,source_job_id,source_inbox_id,name,kind_tool,source_name,source_mime_type,input_size,result_object_key,result_file_name,result_mime_type,result_size,page_count,protected_pdf,created_at,updated_at)
    values(p_user_id,doc_id,null,r.id,r.name,'import_pdf',r.name,'application/pdf',r.size,'inbox-documents/'||p_user_id::text||'/'||r.id::text||'.pdf',r.name,'application/pdf',r.size,r.page_count,r.protected_pdf,saved_at,saved_at);
  insert into public.workspace_document_versions(id,document_id,source_job_id,source_inbox_id,version_number,kind_tool,result_object_key,result_file_name,result_mime_type,result_size,page_count,protected_pdf,created_at)
    values('version_'||doc_id||'_1',doc_id,null,r.id,1,'import_pdf','inbox-documents/'||p_user_id::text||'/'||r.id::text||'.pdf',r.name,'application/pdf',r.size,r.page_count,r.protected_pdf,saved_at);
  update public.workspace_inbox set status='accepted',document_id=doc_id,accepted_at=saved_at where id=r.id returning * into r;
  insert into public.workspace_inbox_events(user_id,receipt_id,action) values(p_user_id,r.id,'accepted');
  insert into public.workspace_activity(id,user_id,document_id,action,tool,version_number)
    values(gen_random_uuid(),p_user_id,doc_id,'imported','import_pdf',1),(gen_random_uuid(),p_user_id,doc_id,'saved','import_pdf',1);
  perform public.enqueue_workspace_workflows(p_user_id,doc_id);
  return next r;
end;
$$;

create or replace function public.archive_workspace_inbox(p_user_id uuid,p_id uuid,p_archive boolean)
returns setof public.workspace_inbox language plpgsql security definer set search_path='' as $$
declare r public.workspace_inbox;
begin
  if p_archive is null then raise exception 'invalid_request'; end if;
  select * into r from public.workspace_inbox where id=p_id and user_id=p_user_id and status<>'uploading' for update;
  if not found then raise exception 'not_found'; end if;
  if p_archive and r.status<>'archived' then
    update public.workspace_inbox set status='archived',archived_at=now() where id=r.id returning * into r;
    insert into public.workspace_inbox_events(user_id,receipt_id,action) values(p_user_id,r.id,'archived');
  elsif not p_archive and r.status='archived' then
    update public.workspace_inbox set status=case when accepted_at is not null then 'accepted' else 'received' end,archived_at=null where id=r.id returning * into r;
    insert into public.workspace_inbox_events(user_id,receipt_id,action) values(p_user_id,r.id,'restored');
  end if;
  return next r;
end;
$$;
revoke all on function public.reserve_workspace_inbox(uuid,uuid,text,bigint,text,integer,boolean) from public,anon,authenticated;
revoke all on function public.finish_workspace_inbox(uuid,uuid) from public,anon,authenticated;
revoke all on function public.accept_workspace_inbox(uuid,uuid) from public,anon,authenticated;
revoke all on function public.archive_workspace_inbox(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.reserve_workspace_inbox(uuid,uuid,text,bigint,text,integer,boolean) to service_role;
grant execute on function public.finish_workspace_inbox(uuid,uuid) to service_role;
grant execute on function public.accept_workspace_inbox(uuid,uuid) to service_role;
grant execute on function public.archive_workspace_inbox(uuid,uuid,boolean) to service_role;
commit;
