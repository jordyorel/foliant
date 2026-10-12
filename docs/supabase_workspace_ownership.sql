-- Apply after supabase_workspace_schema.sql. Existing unowned rows stay private
-- and must be assigned by an administrator to the intended auth.users UUID.
begin;

alter table public.workspace_documents
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

create index if not exists workspace_documents_user_updated_idx
  on public.workspace_documents(user_id, updated_at desc);

alter table public.workspace_documents enable row level security;
alter table public.workspace_document_versions enable row level security;

-- All writes go through the server, which verifies the owner. In particular,
-- clients cannot rewrite storage object keys to reference someone else's file.
revoke all on public.workspace_documents from anon, authenticated;
revoke all on public.workspace_document_versions from anon, authenticated;
grant select on public.workspace_documents to authenticated;
grant select on public.workspace_document_versions to authenticated;

drop policy if exists workspace_documents_owner_read on public.workspace_documents;
create policy workspace_documents_owner_read on public.workspace_documents
  for select to authenticated using (user_id = (select auth.uid()));

drop policy if exists workspace_versions_owner_read on public.workspace_document_versions;
create policy workspace_versions_owner_read on public.workspace_document_versions
  for select to authenticated using (
    exists (select 1 from public.workspace_documents d
      where d.id = document_id and d.user_id = (select auth.uid()))
  );

commit;
