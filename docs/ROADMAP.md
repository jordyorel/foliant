# Foliant Roadmap

This roadmap is the operational source of truth for what gets built next.

It keeps the product direction, engine categories, free vs premium split, architecture checkpoints, and execution checklist in one place.

---

## Free Simple vs Premium Advanced Rule

Core principle:
- [x] Free tools must solve the common user problem quickly without forcing a browser editor.
- [x] Premium/advanced tools add visual control, preview, batch, larger files, saved history, precision, and higher processing cost.
- [x] Do not build the full browser editor before the simple engines that can work without it.

### Engine A — PDF Core

V1 without browser editor:
- [x] merge PDF with file order list
- [x] split PDF by rule: every page, every N pages, or typed range
- [x] extract PDF pages by typed range
- [x] delete PDF pages by typed range
- [x] rotate the whole PDF
- [x] add page numbers with preset positions
- [x] add text watermark with center, diagonal, and repeated presets
- [x] protect PDF with password
- [x] unlock PDF with provided password

V2 with preview/editor, usually premium:
- [ ] reorder PDF with page thumbnails and drag-and-drop
- [ ] delete pages by clicking thumbnails
- [ ] extract pages by selecting thumbnails
- [ ] rotate page by page
- [ ] place signature visually
- [ ] place text or annotations visually
- [ ] place watermark manually
- [ ] fill PDF forms visually

### Engine B — Compression

V1 without browser editor:
- [x] compress PDF
- [x] compress image

V2 premium/advanced:
- [ ] batch compression
- [ ] larger file limits
- [ ] advanced quality controls
- [ ] optional structural optimization with qpdf

### Engine C — Office Conversion

V1 without browser editor:
- [ ] Word to PDF
- [ ] Excel to PDF
- [ ] PowerPoint to PDF
- [ ] PDF to Word
- [ ] PDF to Excel
- [ ] PDF to PowerPoint

V2 premium/advanced:
- [ ] batch conversion
- [ ] larger file limits
- [ ] priority worker queue
- [ ] higher-fidelity conversion modes

### Engine D — Image and Markdown

V1 without browser editor:
- [x] JPG to PDF
- [x] PNG to PDF
- [x] HEIC to JPG
- [x] HEIC to PNG
- [x] PDF to JPG
- [x] PDF to PNG
- [x] Markdown to PDF

V2 premium/advanced:
- [ ] batch image conversion
- [ ] custom image ordering
- [ ] custom PDF page size and margins
- [ ] high-resolution exports

### Engine E — OCR and AI

V1 without browser editor:
- [ ] image to text
- [ ] OCR PDF
- [ ] document summarizer
- [ ] PDF translator

V2 premium/advanced:
- [ ] chat with document
- [ ] multi-document analysis
- [ ] audio/video to text
- [ ] saved AI history

---

## Engine Categories

### Engine A — PDF Core

Purpose: manipulate PDF structure and lightweight PDF edits.

Features:
- [x] merge PDF
- [x] split PDF, first rule-based version
- [x] rotate PDF
- [x] delete PDF pages
- [x] extract PDF pages
- [ ] reorder PDF pages
- [ ] insert PDF pages
- [x] add page numbers
- [x] watermark PDF
- [ ] add text to PDF
- [ ] fill PDF
- [ ] sign PDF visually
- [x] protect PDF
- [x] unlock PDF with provided password

Notes:
- [ ] Avoid rasterizing full PDFs unless required.
- [ ] Prefer structural PDF operations when possible.
- [ ] Keep V1 signature visual only, not certified electronic signature.

### Engine B — Compression

Purpose: reduce file size for PDFs and images.

Features:
- [x] compress PDF, first technical version
- [x] compress PDF, production-quality options, first UI and engine mapping
- [x] compress image, first technical version
- [ ] advanced compression later for paid users

Technologies:
- [x] Ghostscript for PDF compression
- [ ] qpdf for structural optimization when useful
- [x] Sharp for image compression

Notes:
- [x] This is the first engine to implement.
- [x] Track original size, output size, and saved percentage.
- [ ] Validate compression quality on real large PDFs.

### Engine C — Office Conversion

Purpose: convert Office documents to/from PDF.

Features:
- [ ] Word to PDF
- [ ] PDF to Word
- [ ] Excel to PDF
- [ ] PDF to Excel
- [ ] PowerPoint to PDF
- [ ] PDF to PowerPoint

Technologies:
- [ ] LibreOffice headless
- [ ] dedicated worker pool

Notes:
- [ ] Do not run LibreOffice inside request handlers.
- [ ] Add this only after the upload/job/worker pipeline is stable.
- [ ] Treat this engine as heavier and more failure-prone than PDF Core and Compression.

### Engine D — Image and Markdown

Purpose: handle lightweight non-Office conversions.

Features:
- [x] JPG to PDF
- [x] PNG to PDF
- [x] HEIC to JPG
- [x] HEIC to PNG
- [x] PDF to JPG
- [x] PDF to PNG
- [x] Markdown to PDF

Technologies:
- [x] Sharp for image processing
- [x] PDF renderer for PDF to image
- [x] Lightweight Markdown to PDF pipeline
- [ ] Markdown to HTML to PDF pipeline for higher fidelity

Notes:
- [x] Prioritize Image to PDF and PDF to image in V1.
- [x] Markdown to PDF first version keeps the conversion catalogue coherent.

### Engine E — OCR and AI

Purpose: add higher-value paid features once traffic and conversion exist.

Features:
- [ ] image to text
- [ ] scan to text
- [ ] OCR PDF
- [ ] PDF translator
- [ ] document summarizer
- [ ] audio/video to text
- [ ] chat with document

Notes:
- [ ] Exclude these from V1.
- [ ] Gate these features behind paid usage or strict quotas.
- [ ] Track variable processing costs.

---

## Current Foundation

Status: in progress.

Completed:
- [x] Next.js project initialized.
- [x] Multilingual routes are in place.
- [x] Shared landing page behavior is in place.
- [x] Tool URLs reuse the landing page hero and uploader.
- [x] Tool catalogue is data-driven.
- [x] Full bottom catalogue appears consistently on the home page and every tool page.
- [x] Project folders are organized around app, components, content, lib, processors, and docs.
- [x] Upload/job/status/download pipeline exists.
- [x] Processor registry is connected to job execution.
- [x] Local temporary upload storage exists.
- [x] Local temporary result storage exists.
- [x] Result download endpoint exists.
- [x] Basic error states exist in the upload UI.
- [x] Ghostscript is installed locally.
- [x] qpdf is installed locally for PDF protection and unlock.
- [x] First `compress_pdf` processor is connected.
- [x] Build passes.
- [x] Typecheck passes.
- [x] Basic public SEO metadata, canonical links, hreflang, sitemap, and robots.txt exist.
- [x] Public homepage includes clear pricing blocks for Free, Day Pass, Week Pass, and Pro.

Remaining before real processing is production-ready:
- [x] cleanup rules for temporary files
- [ ] analytics event placeholders
- [x] test fixtures
- [x] automated API tests
- [ ] larger real-world PDF compression tests
- [ ] production storage decision
- [ ] worker isolation decision

---

## Phase 1 — Core Pipeline

Goal: make one complete document-processing flow work end to end.

Build:
- [x] real local file upload
- [x] local temporary storage
- [x] job creation
- [x] processor registry
- [x] processing execution
- [x] result file storage
- [x] result download
- [x] cleanup rules
- [x] clear baseline error handling
- [ ] analytics event placeholders
- [x] test fixtures

Definition of done:
- [x] user uploads a file
- [x] job runs through a registered processor
- [x] result is generated
- [x] user can download the result
- [x] failed jobs show a readable error
- [x] build passes
- [x] cleanup is automatic
- [x] API flow has automated coverage

---

## Phase 2 — First Engine: Compression

Goal: implement Engine B first with `compress_pdf`.

Build:
- [x] `processors/compression/pdf.ts`
- [x] Ghostscript-based compression
- [x] output size calculation
- [x] saved percentage calculation
- [x] result download
- [x] UI result summary
- [x] compression quality options
- [x] clear missing-Ghostscript error in UI
- [x] real PDF fixture set
- [x] API tests for compression success/failure

First supported page:
- [x] `/fr/compresser-pdf`

Then:
- [x] `/en/compresser-pdf`
- [x] `/es/compresser-pdf`
- [x] `/pt/compresser-pdf`

Definition of done:
- [x] real PDF input is accepted
- [x] compressed PDF is generated
- [x] download works
- [x] original size and compressed size are shown
- [x] missing Ghostscript has a clear user-facing error
- [ ] large real-world PDF compression is validated
- [ ] compressed output quality is acceptable

---

## Phase 3 — First 5 Tools

Goal: validate the shared page, upload, job, processor, and download architecture across multiple tools.

Tools:
- [x] Compress PDF
- [x] Merge PDF
- [x] Split PDF
- [x] JPG to PDF
- [x] PDF to JPG

Engine coverage:
- [x] Compression: Compress PDF
- [x] PDF Core: Merge PDF
- [x] PDF Core: Split PDF
- [x] Image and Markdown: JPG to PDF
- [x] Image and Markdown: PDF to JPG

Definition of done:
- [x] all 5 tools use the same page archetype
- [x] all 5 tools use the same job pipeline
- [x] no duplicated page layouts
- [x] each tool has clear errors and result download

---

## Phase 4 — V1 Tool Set

Goal: reach the useful V1 catalogue from the master strategy.

Tools:
- [x] Merge PDF
- [x] Split PDF, first rule-based version
- [x] Compress PDF, first version
- [ ] Compress PDF, production version
- [x] Compress Image, first version
- [x] JPG to PDF
- [x] PNG to PDF
- [x] PDF to JPG
- [x] PDF to PNG
- [x] Markdown to PDF
- [x] Rotate PDF
- [x] Delete PDF Pages
- [ ] Reorder PDF Pages
- [x] Watermark PDF
- [x] Protect PDF
- [x] Unlock PDF

Optional if still lightweight:
- [x] Add Page Numbers
- [ ] Sign PDF visually

Definition of done:
- [x] tools are config-driven
- [x] processors are registered centrally
- [x] all public pages are indexable
- [x] English and French pages are usable
- [x] SEO metadata exists
- [ ] basic analytics events exist

---

## Phase 5 — SEO and Public Launch

Goal: prepare public acquisition.

Build:
- [x] dynamic metadata
- [x] canonical URLs
- [x] hreflang
- [x] sitemap
- [x] robots.txt
- [ ] structured data for tool pages
- [ ] guides for the first tools
- [ ] internal linking matrix

Languages:
- [x] English
- [x] French
- [x] Spanish, interface baseline
- [x] Portuguese, interface baseline

Later:
- [ ] Arabic
- [ ] German
- [ ] Italian
- [ ] Chinese
- [ ] Japanese
- [ ] Korean

Definition of done:
- [ ] core pages are crawlable
- [ ] no duplicate-content mistakes
- [ ] each tool page has a useful title, H1, description, FAQ, and related tools

---

## Phase 6 — Monetization

Goal: add paid conversion without dark patterns.

Plans:
- [ ] Free: 3 jobs per 24h
- [ ] Day Pass: one-time 24h access
- [ ] Week Pass: one-time 7-day access
- [ ] Pro Monthly
- [ ] Pro Annual

Build:
- [ ] quotas
- [ ] anonymous usage tracking
- [ ] account usage tracking
- [ ] Stripe checkout
- [ ] Stripe webhooks
- [ ] payment status
- [ ] upgrade prompts

Definition of done:
- [ ] free quota works
- [ ] paid access works
- [ ] billing copy is explicit
- [ ] cancellation is clear for subscriptions

---

## Phase 7 — Workspace

Goal: create retention.

Build:
- [ ] recent documents
- [ ] recent jobs
- [ ] download previous results before expiration
- [ ] delete file
- [ ] billing status
- [ ] saved signature later

Definition of done:
- [ ] logged-in users can return and find recent activity
- [ ] temporary storage rules remain clear

---

## Phase 8 — Advanced Engines

Goal: add higher-value features after the basic engine catalogue works.

Add:
- [ ] Office Conversion engine
- [ ] OCR and AI engine
- [ ] templates/generators
- [ ] advanced PDF editing

Definition of done:
- [ ] advanced tools are paid or quota-controlled
- [ ] processing cost is tracked
- [ ] worker isolation is in place

---

## Long-Term Vision — Document Operations SaaS

This is a future direction, not the current MVP scope.

Positioning:
- [ ] Keep public PDF/document tools as the acquisition funnel.
- [ ] Evolve from "PDF utilities" to "documents into workflows".
- [ ] Make Foliant useful for individuals first, then teams, then businesses.

Future product layers:
- [ ] Public tools: convert, compress, merge, OCR, extract, sign.
- [ ] Document workspace: documents, folders, search, history, teams.
- [ ] Document intelligence: OCR, classification, data extraction, document chat.
- [ ] Automation: rules, approvals, notifications, exports.
- [ ] Platform/API: business integrations, API usage, agent access.

Business workflow examples:
- [ ] Supplier invoice inbox by email.
- [ ] Automatic document classification.
- [ ] Extraction of vendor, invoice number, amount, VAT, date, currency, and PO.
- [ ] Approval rules by amount and role.
- [ ] Export to Excel, ERP, or API.
- [ ] Archive with audit trail.

Enterprise capabilities:
- [ ] System of Record: versions, statuses, validations, suppliers, history.
- [ ] System of Control: roles, permissions, approval thresholds.
- [ ] System of Learning: repeated supplier formats and learned field positions.
- [ ] System of Workflow: no-code rules and document routing.

Important constraint:
- [x] Do not build these layers now.
- [x] Keep the current MVP focused on public tools, SEO, upload/job/download, and the V1 engine catalogue.

---

## Immediate Next Steps

- [x] Finish the local processing pipeline.
- [x] Connect `compress_pdf` to the processor registry.
- [x] Install or require Ghostscript locally.
- [x] Generate a real compressed PDF result.
- [x] Add result size metrics to the UI.
- [x] Add cleanup for `.tmp/uploads` and `.tmp/results`.
- [x] Add compression quality options.
- [x] Add test fixtures and automated API tests.
- [ ] Validate compression on real large PDFs.
- [x] Start the next tool from Phase 3 (Fusionner PDF).
- [x] Finish Merge PDF first version.
- [x] Finish Split PDF first rule-based version.
- [x] Finish Image to PDF first version.
- [x] Finish PDF to image first version.
- [x] Expose all planned catalogue items consistently at the bottom of every page.
- [x] Add homepage pricing blocks so monetization is visible early.
- [x] Add SEO metadata, canonical links, hreflang, sitemap, and robots.txt for public pages.
- [x] Finish Markdown to PDF first version.
- [ ] Start Office conversion prerequisites with LibreOffice headless.
