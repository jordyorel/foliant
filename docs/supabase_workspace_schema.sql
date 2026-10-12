-- Foliant Studio 0.5 production workspace schema.
-- Run this in the Supabase SQL editor, then create a private Storage bucket
-- named `workspace-documents` unless SUPABASE_WORKSPACE_BUCKET is changed.

create extension if not exists pgcrypto;

create table if not exists public.workspace_documents (
  id text primary key,
  source_job_id text not null,
  name text not null,
  kind_tool text not null,
  source_name text,
  source_mime_type text,
  input_size bigint,
  result_object_key text not null,
  result_file_name text not null,
  result_mime_type text not null,
  result_size bigint not null,
  page_count integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists workspace_documents_updated_at_idx
  on public.workspace_documents (updated_at desc);

create table if not exists public.workspace_document_versions (
  id text primary key,
  document_id text not null references public.workspace_documents(id) on delete cascade,
  source_job_id text not null,
  version_number integer not null check (version_number > 0),
  kind_tool text not null,
  result_object_key text not null,
  result_file_name text not null,
  result_mime_type text not null,
  result_size bigint not null,
  page_count integer,
  created_at timestamptz not null default now(),
  unique (document_id, version_number)
);

create index if not exists workspace_document_versions_document_idx
  on public.workspace_document_versions (document_id, version_number desc);

alter table public.workspace_documents enable row level security;
alter table public.workspace_document_versions enable row level security;

grant select, insert, update, delete on public.workspace_documents to service_role;
grant select, insert, update, delete on public.workspace_document_versions to service_role;

-- Server routes use the secret/service role key and bypass RLS.
-- Also apply supabase_workspace_ownership.sql for Studio 0.6 accounts.
