-- Cross-device Magic Link handoff for Foliant.
-- Run after the workspace/account migrations. Rows are only accessed by the
-- server with the Supabase secret key; session material is AES-GCM encrypted
-- before it reaches this table and is deleted when the original browser claims it.

create table if not exists public.auth_login_attempts (
  id uuid primary key,
  verifier_hash text not null,
  state text not null default 'pending' check (state in ('pending', 'confirmed')),
  session_ciphertext text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists auth_login_attempts_expires_at_idx
  on public.auth_login_attempts (expires_at);

alter table public.auth_login_attempts enable row level security;
revoke all on public.auth_login_attempts from anon, authenticated;
grant select, insert, update, delete on public.auth_login_attempts to service_role;
