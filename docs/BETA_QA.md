# Local Beta Verification

Updated: 2026-09-29. This is a local verification report, not production approval.

## Automated Results

- Full suite: 215 passed, one skipped, 17 test files.
- The skipped case checks missing qpdf; qpdf is installed and its round-trip tests run.
- Production build and TypeScript completed successfully; diff whitespace check passed.
- Tests use isolated temporary storage, not the live Supabase workspace.

Covered processors: PDF/image compression, merge, split, extraction, deletion,
rotation, insertion, numbering, watermark, image/Markdown to PDF, PDF to images,
HEIC to JPEG/PNG, password protection/unlock, Office to PDF and selectable-text
PDF to Word/Excel/PowerPoint. These tests verify supported examples, not fidelity
on all customer files. Scanned PDF to Office still requires unavailable OCR.

Covered application behavior: upload/job/download handlers, editor edits,
durable-save/version operations with local test storage, ownership denial across
mocked accounts, Guest session revocation, expiration, job snapshots/recovery,
queue/drain behavior, cleanup leases/orphans, rate-limit buckets, body limits,
log allowlisting and exclusion of unfinished tool catalogue entries.

## Browser Smoke Checks

Only the user-designated JORDY_OREL_KONDA_FlowCV_Resume_En.pdf was used for
manual document testing. Its original and durable workspace record were not edited.

- Public reorder page upload and transition into Guest Studio: passed after fixing
  missing initial page order.
- PDF rendering, rotation, Undo/Redo and applying edits: passed.
- Drag-and-drop downward and upward: passed.
- Inserting the same reference PDF after reordering: passed; count increased from
  two to four pages, and Add remained available.
- Guest status and login-to-save controls remained visible after processing.
- Desktop rendering and 390px mobile layout inspected; document width did not
  exceed the viewport. Full touch-device/cross-browser QA is still pending.
- Opening the now-expired test job in a fresh tab displayed Document introuvable.
- A manual download attempted after the job was more than 45 hours old failed as
  expected for expired content. Fresh successful downloads are covered by API tests,
  not claimed as a successful manual browser download in this pass.

## Not Yet Validated Or Delivered

- Magic Link signup/login has been manually validated locally with Supabase's test
  email service. The cross-device handoff has automated coverage, but needs a
  manual desktop-and-phone confirmation now that `supabase_auth_login_attempts.sql`
  is applied. Custom domain SMTP, two real account sessions, and a complete
  Supabase-backed save/restore/delete acceptance pass remain required before launch.
- Real host restart, pre-stop integration, scheduled cleanup and multi-instance
  deployment are not validated. Current processing assumes one persistent-volume writer.
- OCR/AI, real signature drawing/import, forms, sharing, teams, billing and workflow
  modules are not released features. Tool pages/catalogues omit unfinished tools;
  Studio prototype modules remain in source and their navigation shortcuts are hidden.
- Legal/support footer destinations and production operational policies still need
  completion before public launch; no legal compliance claim is made here.
- Automated text annotation and version tests are not a substitute for a full manual
  mobile editor and authenticated account acceptance pass.

## Fixes From This Pass

- HEIC PNG fallback uses a TIFF intermediate rather than lossy JPEG conversion.
- Reorder/text/insert public entry prepares an initial full page order before opening Studio.
- Requests and per-session queued work are bounded; upload bytes are capped while read.
- Logs whitelist metadata and public job failures no longer expose raw subprocess errors.
- Unfinished tools and misleading editor/dashboard shortcuts are removed from launch navigation.
- Removed the dashboard's fictitious 18/100 quota and inactive plan/upgrade panel.
- The complete bottom-of-page catalogue keeps unfinished tools visible as non-clickable
  entries labelled "Coming soon" (localized per language), while released tools remain links.
