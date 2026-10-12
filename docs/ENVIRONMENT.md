# Environment

## Workspace Storage

Local development uses the filesystem adapter by default:

```bash
WORKSPACE_STORAGE_DRIVER=local
```

Production 0.5 uses Supabase:

```bash
WORKSPACE_STORAGE_DRIVER=supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SECRET_KEY=your-secret-key
SUPABASE_WORKSPACE_BUCKET=workspace-documents
```

Run `docs/supabase_workspace_schema.sql` in Supabase and create a private
Storage bucket named `workspace-documents`.

`SUPABASE_SECRET_KEY` must only be used on the server. The legacy
`SUPABASE_SERVICE_ROLE_KEY` variable is still accepted for older projects, but
new Supabase projects should use a key that starts with `sb_secret_`.

## Studio Accounts (0.6)

Add the public project's publishable key on the server as well:

```bash
SUPABASE_PUBLISHABLE_KEY=sb_publishable_your-project-key
```

Do not substitute the secret key here. Auth uses the official Supabase SSR
client, HttpOnly cookies and `getUser()` verification. The secret key remains
server-only for the workspace adapter. Auth is unavailable when the publishable
key is missing; this never enables an unauthenticated save fallback.

Activation checklist:

1. Run `docs/supabase_workspace_ownership.sql` after the base schema. It adds
   `user_id`, indexes and owner-only read policies. All document writes remain
   server-only; direct authenticated updates of storage object keys are denied.
2. Enable the Email provider and new user signups in Supabase Authentication.
3. Run `docs/supabase_auth_login_attempts.sql`. The app uses this private table
   to support a Magic Link opened from another device: its encrypted, short-lived
   session handoff is consumed once by the browser where sign-in started.
4. The app uses Supabase's standard Magic Link email. The callback shows a
   confirmation page and signals the original Studio page to create its own
   HttpOnly session. The default Supabase template is sufficient for a
   team-member test; custom SMTP is needed before public use.
5. Configure the Site URL for the deployed site and a production SMTP provider
   before opening signup to real users. Review Supabase OTP expiration and rate
   limits; the UI also waits 60 seconds between resend attempts.
6. Restart the dev server after environment changes, then use **Se connecter**
   in Studio. Test two separate accounts and confirm each sees only its files.

Existing documents with `user_id IS NULL` are retained but invisible to all
accounts. Never assign them to the first visitor. An administrator may attach a
specific legacy document to its verified owner using that user's `auth.users.id`.
The existing Jordy test document is intentionally not modified by the migration.

References: [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
and [email codes](https://supabase.com/docs/guides/auth/auth-email-passwordless).

## Inbox Server Foundation

Apply `docs/supabase_workspace_inbox.sql` after the atomic-save migration.
It is additive: existing documents are not ingested or reassigned. It adds
owner-only receipt/event tables and private server RPCs; use the existing private
workspace bucket. The local filesystem adapter deliberately returns unavailable.
The migration was applied and checked on the Foliant Supabase project on
12 October 2026. Inbox UI and real-account reception QA remain pending.

Authenticated API: `POST /api/studio/inbox` takes raw `application/pdf`, an
URL-encoded `X-File-Name` and a UUID `Idempotency-Key`. GET lists one status with
50 items per page (`status`, `offset`). Receipt routes provide detail, private
file, POST accept and PATCH `{ "archive": true | false }`. Mutations require
same origin. Limits: 25 MiB/file, 200 receipts and 250 MiB/account including
archives/pending reservations; 20 mutations/user/minute and 100 globally.
Single-process rate counters do not replace production edge protection.

Encrypted PDFs remain unchanged and downloadable, with inline preview blocked.
`qpdf` is required to recognize encrypted object streams when pdf-lib cannot
inspect them; page count may be unknown. No password is retained. A received
file is not malware-scanned and no email connector is activated by this migration.

Acceptance copies the original to a separate Documents key, then atomically
creates document/V1/activity/workflow queue. If the copy succeeds but SQL fails,
retry with the same receipt; the deterministic copy is overwritten with identical
verified bytes. Failed upload reservations and pre-commit copies count towards
quota or remain private; automatic orphan purging is not implemented yet.
Do not delete an original or a copy on an ambiguous timeout.

## Temporary Sessions

Guest files are scoped to a separate HttpOnly browser-session cookie. Each open
editor registers a tab identifier. Leaving releases that tab; the last registered
tab's release revokes the chain and deletes completed results. Internal tool
transitions transfer the tab identifier. Downloads do not close the session.
Refresh is a full-page exit and warns before discarding temporary work.

Close signals are best-effort. If the browser or network disappears, six-hour
expiration still denies access; physical TTL cleanup runs on requests or through
the protected maintenance endpoint. A production schedule is still required.
Jobs, revoked chains and tab membership are persisted for a single writer process
on the same volume; multi-instance coordination is not implemented.

Signing out revokes temporary jobs for that browser session and clears its
credential. Account creation/login does not revoke the active Guest document.

Automated tests use an isolated temporary data root and the local workspace
adapter, never the real Supabase workspace or the development `.tmp` directory.
# Scheduled Temporary Cleanup

## Beta Request Protection And Logs

The process-shared one-minute limiter allows 120 upload requests (init + PUT),
60 job-creation requests and 20 authentication requests per Guest session.
Corresponding global limits are 600, 300 and 100 per minute. Requests without a
Guest cookie share an anonymous bucket; forwarded IP headers are not trusted.
At most four queued/processing jobs are accepted per session. Rejections return
429 or capacity-related 503 with Retry-After. Bodies are bounded while streaming:
uploads use the tool limit, upload-init/auth JSON is 8 KiB and jobs JSON 256 KiB.

These are resource-safety limits, not billing restrictions. A caller can rotate
cookies, so session limits alone are not an identity or anti-bot guarantee. Global
limits still apply. Counters reset on restart and are not shared across instances;
production requires trusted edge rate limiting and request timeouts as well.

Operational events on stdout include only event name, timestamp, a known tool,
a known error code and optional duration. Do not add raw exceptions, request
bodies, filenames, paths, passwords, email addresses or cookies. Job failures
returned to clients use a generic message plus a stable error code. This covers
the application events added here, not an audit of framework/hosting access logs.
External collection, retention and alerts remain deployment work.

`POST /api/maintenance/cleanup` runs the existing temporary upload/result expiry
cleanup without relying on visitor traffic. It never targets the durable workspace.
Set a separate server-only `MAINTENANCE_SECRET` of at least 32 random characters;
do not reuse a Supabase key, commit the value, or put it in a URL.
The scheduler must send `Authorization: Bearer <MAINTENANCE_SECRET>` over HTTPS.
Missing/short configuration fails closed (503); invalid credentials return 401.
Failures return 500 without document names or filesystem paths; success returns
only deletion counts. Configure the scheduler to alert on non-2xx responses.

Deployment activation remains pending: configure a host-level scheduler (for
example every five minutes), then verify expiry on disposable temporary files.
No schedule or secret is provisioned automatically. The endpoint cleans the local
storage of the instance receiving the request: it must run against the actual
persistent volume, not a random serverless instance. Multi-instance deployment
still requires shared temporary storage and durable job/session state. Existing
retention is 15 minutes for uploads and six hours for results. Cleanup of orphaned
processor scratch directories and corrupt metadata remain pending. Old top-level
unregistered result files named `job_<uuid>.<extension>` are now removed after
six hours, except while their job is active or waiting. Registered results use
normal retention; durable workspace files are never scanned by this sweep.
Input/output leases protect accepted jobs from retention cleanup within this
single process and are released when execution ends, including failures.
The endpoint also removes expired job records and unused chain/tab state.

## Single-Server Restart Recovery

### Workflow Queue

Apply `docs/supabase_workspace_workflow_queue.sql` after the workflow management
migration. The queue migration was applied on 2026-10-10. Only service_role can
enqueue or execute; ownership and pinned V1 are checked by the database.
Then apply `docs/supabase_workspace_atomic_save.sql` (applied 2026-10-11).
The server uses this private RPC to commit document metadata, V1 and queue entries
together. Storage upload precedes the transaction; an uncertain response must not
trigger blind deletion of the uploaded object. Retrying the same owner/job returns
the existing document without replaying old rules. The local development adapter
does not provide this database transaction.
New saves enqueue before returning `workflows: queued`; Next.js `after()` performs
bounded background processing. Opening workflow history retries pending entries
for that authenticated owner. Neither mechanism replaces an independent scheduler.

`POST /api/maintenance/workflows` uses the existing server-only maintenance secret
and processes at most ten entries. Configure a supervised process with
`npm run worker:workflows` (15-second polling) or schedule authenticated POSTs.
`WORKFLOW_WORKER_ORIGIN` defaults to `http://localhost:3000`; non-local origins
require HTTPS. `npm run worker:workflows -- --once` performs one pass.
The script refuses redirects and never prints credentials or response bodies.
In `--once` mode, HTTP/network failures exit with status 1 so a supervisor or
scheduler can detect failure. The continuous worker keeps polling after an outage.
No permanent worker or new secret is automatically provisioned.

Supabase commits approval, activity and execution result in the same transaction.
Interrupted database transactions can resume without duplicate sharing. Old inline
entries are excluded because their outcome is ambiguous. Local workflow storage
remains single-process; it uses stable approval ids for crash recovery.
Successful document saving and enqueue are still separate transactions: enqueue
failure is reported, not silently backfilled from older private documents.

`JOB_CONCURRENCY` defaults to 2 (allowed: 1-16); `JOB_MAX_PENDING` defaults
to 20 (allowed: 1-200). These server-only limits apply across all users in one
Node process. Restart after changing them. Saturation returns HTTP 503 with
`Retry-After: 10`; callers must not automatically duplicate previously accepted
jobs. Waiting jobs execute FIFO and recheck source expiry and Guest revocation
before processing. This is not per-user fairness or request-rate limiting, and
does not provide a separate worker process or processor timeouts.

### Deployment Pre-Stop Protocol

Before terminating the sole Node server, the deployment supervisor must call
`POST /api/maintenance/drain` using the same maintenance Bearer secret. Repeat
every two seconds while it returns 202. Admission stays closed; accepted queued
and active jobs finish normally. HTTP 200 with `drained: true` means the supervisor
can terminate the process. Authentication failures or non-2xx responses must not
be interpreted as drained. The draining state is irreversible until restart.

This protocol is implemented but not wired to a hosting provider yet. No signal
handlers override Next.js. Sending SIGTERM without the pre-stop protocol still
uses Next.js shutdown behavior and can interrupt jobs. Configure a bounded host
deadline; if it expires, force termination and rely on restart recovery marking
unfinished jobs failed. Do not run overlapping instances during deployment.

Set `FOLIANT_DATA_ROOT` to an absolute path on a persistent writable volume before
the first upload in production. Without it, development uses `.tmp` under the
project directory. Tests use their isolated `FOLIANT_TEST_DATA_ROOT` instead.
Do not move existing metadata to another path without migrating its absolute
file references. Never point tests or a second server at the production volume.

Temporary job state is stored in `jobs/state.json` using an atomic rename and
owner-only file permissions. Completed jobs, ownership, chain revocation and
registered tabs are restored; queued/processing jobs become failed with an
interruption message. They are not automatically retried. Users may need to
upload again if the original source expired. PDF password options are omitted
from snapshots and remain only in the active process. Corrupt snapshots fail
closed rather than silently discarding revocations.

Use exactly one Node writer process per volume: no clustering, rolling overlap,
horizontal scaling or ephemeral serverless filesystem. A stop-then-start deploy
is required until shared storage and worker coordination are implemented.
This snapshot is not a durable queue and does not resume processors. It does not
promise survival of volume loss or power failure. Protect the volume because
job options can contain document annotations and Guest session identifiers.
Supabase remains the configured store for durable workspace documents.
