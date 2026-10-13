# Foliant Roadmap

This roadmap is the operational source of truth for what gets built next.

It keeps the product direction, engine categories, free vs premium split, architecture checkpoints, and execution checklist in one place.

---

## Point Produit — 12 Octobre 2026

Le produit est une bêta fonctionnelle avancée, pas encore une version validée
pour la production. Les outils PDF principaux, la signature visuelle, les
formulaires AcroForm, les comptes, les documents et versions, les approbations V1
et les automatisations V1 sont implémentés. Les approbations et une exécution
d'automatisation ont été validées avec deux comptes réels ; cela ne remplace pas
la validation complète du parcours de lancement.

- [x] Corriger le catalogue public : Remplir PDF et Signer PDF sont disponibles,
  avec pages dédiées dans les quatre langues et ouverture du bon outil après import.
- [x] Appliquer la migration de modification/archivage des automatisations sur
  Supabase et valider ces deux opérations réelles (10 octobre). Script comparé
  au fichier local avant exécution, succès confirmé dans le SQL Editor intégré.
  Modification puis archivage de la seule règle QA dans Safari ; historique
  conservé. Colonnes, RLS et droits privés vérifiés sur Supabase.
- [x] Implémenter la file durable des automatisations hors du chemin de sauvegarde :
  traitement après réponse, reprise à la réouverture et endpoint de worker protégé.
  Migration additive appliquée sur Supabase le 10 octobre, RPC privées et RLS vérifiés.
  Transaction approbation/journal, panne simulée et deux workers SQL concurrents
  validés sur PostgreSQL local (10/11 octobre).
- [x] Valider un arrêt brutal de PostgreSQL local et la reprise du vrai script
  worker sur un PDF neutre : entrée en attente, transaction interrompue et réponse
  perdue après commit. Trois approbations uniques, fichier inchangé (11 octobre).
  Interface HTTP de QA isolée, pas le parcours Next.js/Supabase avec comptes réels.
- [x] Fermer la fenêtre entre premier enregistrement et mise en file sur Supabase :
  document, V1 et enqueue dans une transaction privée ; migration appliquée et droits
  vérifiés le 11 octobre. Panne et nouvelle tentative testées sans doublon ni replay.
- [x] Clôturer Automatisations V1 : recette Next.js/Supabase avec deux comptes réels
  le 11 octobre, PDF neutre enregistré, une approbation de V1 reçue et approuvée,
  journal terminé, règle QA archivée et isolation des listes/archives vérifiée.
  Le redémarrage réel sur hébergement reste un gate de lancement, pas un nouveau lot V1.
- [x] Construire le socle Inbox lot A : réception PDF privée, API de dépôt/liste/
  détail/fichier, acceptation atomique en V1 et archivage récupérable. Migration
  appliquée sur Supabase le 12 octobre ; RLS et RPC privées vérifiées. Tests API
  simulés et PostgreSQL local : rollback, retries, isolation, PDF protégé et deux
  acceptations concurrentes sans doublon. 330 tests réussis, un ignoré ; TypeScript valide.
- [x] Construire l’interface Inbox : dépôt distinct de l’import d’outils, liste,
  recherche/tri serveur, filtres, pagination, détail/aperçu/actions, compteur réel,
  quatre langues et QA Chromium bureau/mobile avec API simulées (12 octobre).
- [ ] Valider Inbox lot A dans le navigateur avec deux comptes réels : original
  intact, V1 conservée après reconnexion, règles après acceptation et isolation.
- [ ] Activer le worker indépendant sur hébergement et valider un arrêt/redémarrage
  réel entre deux comptes. Aucun worker permanent provisionné automatiquement.
- [ ] Terminer les gates de lancement : SMTP du domaine, parcours de compte
  complet et téléphone réel, sauvegarde/reprise, rétention planifiée,
  exploitation et validation sur hébergement. Déploiement différé par choix.

Prochaine étape : recette Inbox V1 avec deux comptes réels, détaillée dans
`docs/INBOX_V1.md`. L’interface et l'ajout transactionnel à Documents sont en
place (lot A), puis connecter un fournisseur email entrant réel (lot B).
Aucun partage au seul moment de réception.

La recette Inbox reste à effectuer ; OCR/IA, équipes, facturation et signatures certifiées restent à développer
ou différés. Le prochain chantier de développement cadré est l'édition du texte
existant inspirée de Sejda : plan technique et critères dans
`docs/PDF_TEXT_EDITOR_V1.md`. Commencer par le prototype de détection de police
et d'export natif avant l'interface ; fonctionnalité non implémentée. La réception
email reste différée pendant ce chantier. Images, formes et liens restent des
extensions distinctes, sans promesse de parité avec l'éditeur Sejda.
Les anciennes sections ci-dessous conservent l'historique ; ce point et la
checklist de lancement priment pour lire l'état actuel.

## Reprise Produit — 5 Octobre 2026

Les validations restantes de la refonte sont différées et restent suivies dans
`docs/REFONTE_DESIGN_SEO_STUDIO.md` : Brave, comptes réels et téléphone. Elles ne
sont pas considérées comme terminées. Le déploiement reste différé.

Priorité initiale du 5 octobre : Studio 0.8, première demande d'approbation sur une
version précise d'un document sauvegardé. Cette étape est désormais validée avec
deux comptes réels (9 octobre), suivie d'Automatisation V1 (10 octobre). Les
extensions de l'éditeur (images, formes, annotations, liens et texte existant
inspirés de Sejda) restent en attente ; elles ne bloquent pas ce lot. Aucune
restriction Guest ou premium supplémentaire n'est introduite.

- [x] Ajouter une date : choix du format numérique, long ou ISO, placement et
  modification sur le PDF. Annotation texte réutilisant l'historique et l'export.
  Placement, Annuler/Rétablir et téléchargement testés dans le navigateur ; date
  confirmée dans le fichier téléchargé par pypdf et rendu Poppler. Fenêtre vérifiée
  sur bureau et viewport mobile de 390 px. TypeScript et 68 tests ciblés réussis,
  un test conditionnel ignoré (2026-10-05).
- [ ] Insérer une image : import, placement, déplacement et redimensionnement
  proportionnel.
- [ ] Intégrer ces annotations à Annuler/Rétablir et à l'export PDF ; vérifier
  leur présence dans le fichier téléchargé, pas seulement dans l'aperçu.

Inbox et les signatures certifiées restent différés. Automatisation V1 est
implémentée (10 octobre 2026), avec la migration Supabase appliquée et l'écran
validé sur un compte réel dans Safari. Une exécution réelle entre deux comptes
est validée sur un PDF fictif : approbation de V1, isolation des règles et pause
finale ; voir `docs/WORKFLOWS_QA.md` pour les contrôles complémentaires.
Approbations V1 est implémenté avec des contrôles d'accès dédiés et un partage
explicite limité à une version et à son destinataire. La migration Supabase est
appliquée (6 octobre 2026). Le parcours navigateur sur Brave avec deux comptes
réels est validé (9 octobre) : demande, aperçu, approbation, refus, annulation,
retour propriétaire, persistance et refus d'accès à l'éditeur privé.
Le build de production est validé. L'écran Guest est vérifié à 360 et 390 px ;
les contrôles connectés en émulation mobile Brave (390 × 844) et version figée
après édition sont validés. Voir `docs/APPROVALS_QA.md`. Aucun test sur téléphone
physique ni déploiement n'est revendiqué.

## Launchable Beta — Current Priority

Target: a free public beta with reliable PDF tools and an individual Studio.
This checklist is the release gate; older feature checkboxes are not a launch promise.

- [x] Studio: Compresser image propose Taille minimale, Équilibré et Meilleure qualité avant traitement, avec Équilibré par défaut; les trois niveaux existaient déjà dans le moteur Sharp.
- [x] PDF vers image: JPG/PNG et les résolutions Web (72 DPI), Standard (150 DPI) et Haute définition (300 DPI) sont choisissables dans le parcours public et le Studio; l'API valide la plage DPI.
- [x] PDF vers Word, Excel et PowerPoint: les limites de la conversion par extraction de texte sont explicites avant traitement; les PDF scannés restent refusés proprement tant que l'OCR n'est pas disponible.
- [x] Fusionner PDF: le parcours public prend aussi en charge le glisser-déposer pour réordonner les fichiers avant la fusion, en complément des commandes clavier par flèches.
- [x] Lot de petites améliorations: Image vers PDF accepte le glisser-déposer pour fixer l'ordre des pages; Documents propose un filtre par action et un tri par nom, taille ou statut sur les données réelles.
- [x] QA Studio: pour les conversions dont le résultat n'est pas un PDF (ZIP, Office), le canevas indique explicitement qu'il prévisualise le PDF source tandis que le résultat reste téléchargeable.
- [x] Signature visuelle V1: saisir son nom, prévisualiser la signature, la placer/déplacer/redimensionner dans le Studio, puis l'enregistrer dans une nouvelle version du PDF. Ce n'est pas une signature électronique certifiée.
- [x] Remplir un PDF V1: lire les champs AcroForm standards, remplir texte/cases/listes/choix dans le Studio, puis enregistrer une nouvelle version PDF interactive.

- [ ] Accounts: Magic Link signup/login is validated locally with Supabase's test email service. The cross-device handoff migration is applied. Before launch, configure domain SMTP and verify Guest-to-owned save, logout, return visits, desktop-and-phone Magic Link confirmation and isolation with two real accounts.
- [x] Add cross-device Magic Link handoff: the original browser polls a short-lived, encrypted, one-time server attempt; the link page confirms success and can be closed without redirecting away from the initial work.
- [x] Apply the private `auth_login_attempts` migration to the production Supabase project (2026-09-29).
- [ ] Processing reliability: persist jobs and Guest revocation state outside process memory, define worker recovery after interruption, and validate restart/deploy behavior.
- [x] Single-server foundation: atomically persist temporary job records, Guest revocations and tab membership on disk; restore completed jobs and mark interrupted queued/processing jobs failed without automatic retries. PDF password options are never persisted.
- [ ] Validate a real server restart/deploy on the selected persistent volume; add worker concurrency control, interrupted-output cleanup and graceful shutdown. Multiple writers/instances remain unsupported.
- [x] Prepare an authenticated maintenance endpoint for temporary-file expiry cleanup, independent of visitor requests, with authorization and failure tests.
- [ ] Activate scheduled cleanup on the selected host and verify actual deletion, failures and retention. An endpoint alone is not a running schedule.
- [ ] Hosting: choose a deployment compatible with native processors, configure secrets and persistent/shared storage, and test the deployed end-to-end flow.
- [ ] Abuse protection: enforce file-size, request-rate and concurrent-processing limits server-side for everyone, independently of paid plans.
- [ ] Release QA: upload, edit, download, save, versions, delete, expiry and mobile; hide unfinished controls and tools from the launch surface.
- [x] Fix local HEIC-to-PNG conversion: lossless TIFF decoding through sips followed by Sharp PNG encoding when direct PNG fails; temporary intermediate files are removed. Full processor suite now passes locally.
- [x] Add per-session/global request limits, a four-outstanding-job session limit and streamed upload-size checks. JSON request bodies are bounded; limits are single-process and do not replace edge/network protection.
- [x] Keep unfinished OCR/AI entries marked coming soon and hide dead editor commands and demo shortcuts. Visual signatures and AcroForm filling are available in Studio and the public catalogue.
- [x] Add allowlisted operational job/upload/cleanup logs without filenames, document text, credentials or session IDs; sanitize job failure messages exposed to clients.
- [x] Fix public editor entry: reorder/text/insert pages bootstrap the PDF in its initial order instead of sending an invalid empty page order.
- [x] Run local automated regression and browser smoke checks. Latest result (10 October): 291 tests passed, one conditional missing-qpdf test skipped because qpdf is installed; TypeScript passed. Public catalogue and form/signature pages checked in the browser. The previous production build passed; it has not been rerun for this catalogue correction. See `docs/BETA_QA.md` for coverage and remaining gates.
- [ ] Operations: privacy-safe error monitoring, support contact, retention/privacy information and a recovery procedure for durable data.

Deferred: billing, teams, Inbox, OCR/AI, certified signatures and advanced Office conversion. Approvals V1 and basic automation V1 are implemented and tested between two real accounts; workflow management and durable queue migrations are applied. Background recovery and concurrent SQL workers pass local tests; independent worker activation and real restart QA remain pending.
- [x] Dashboard Studio : Inbox reste « Bientôt disponible » ; Approbations et Automatisation ouvrent leurs modules dédiés sans compteur fictif. Migration Automatisation appliquée et écran réel vérifié dans Safari le 10 octobre 2026.
- [x] Cadrer Inbox V1 : réception distincte des documents conservés et des décisions,
  lot A de dépôt/tri/acceptation, lot B email réel ; `docs/INBOX_V1.md` (11 octobre).
- [x] Inbox lot A — socle serveur et migration Supabase appliquée : stockage privé,
  API, origine d’import explicite, V1/enqueue atomiques, archivage ; tests locaux
  d’isolation/concurrence/panne et 330 tests automatisés réussis (12 octobre).
- [ ] Développer Inbox lot A : stockage privé, dépôt PDF, liste/détail, acceptation
  transactionnelle en V1 et archivage récupérable ; interface implémentée, reste recette
  Supabase avec deux comptes réels avant clôture du lot.
- [ ] Connecter Inbox lot B : domaine/fournisseur entrant, webhook vérifié, pièces
  jointes et retries ; réception email réelle validée avant annonce de disponibilité.
- [x] Add single-process admission control: default two active jobs and twenty waiting jobs, bounded server configuration, FIFO execution and HTTP 503 with Retry-After when saturated. Recheck temporary source expiry and Guest revocation before execution.
- [x] Prepare authenticated pre-stop draining: refuse new jobs, finish accepted FIFO work, report 202 until drained then 200. Protect input/output files of accepted jobs from retention cleanup; remove inactive unregistered result files after six hours.
- [ ] Wire the deployment pre-stop hook to drain before sending termination, set a bounded shutdown deadline and verify on the deployed server. Forced termination still requires restart recovery; nested processor scratch files and corrupt metadata are not covered by orphan-output cleanup.
Automatisations V1 is closed (11 October): atomic first save applied on Supabase and the normal Next.js/Supabase flow validated with two real accounts. Local PostgreSQL crash/restart and the real worker script pass three isolated scenarios; hosting worker activation and full application restart QA remain launch gates. Inbox server foundation is implemented and its migration applied (12 October); Inbox interface and simulated browser QA now pass; next is real-account acceptance QA, keeping ingestion separate from document approval and automated rules. PDF job snapshots still require a persistent single-writer volume; the Supabase workflow queue does not make PDF jobs multi-instance. Production edge protection remains pending.

## Feature Status Labels

- [x] V1 simple/free: tool usable without browser editor, with clear limits.
- [x] Prototype: internal or early usable version, not enough for paid positioning.
- [x] Coming soon: visible in the roadmap/catalogue direction, processor may still be missing.
- [x] Premium later: advanced control, preview, batch, larger limits, saved history, or AI cost.
- [x] Do not publish the paid public product before Studio gives users a reason to pay.

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
- [x] add page numbers with position, format, start, size, color and margin controls with Studio preview
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
- [x] Word to PDF
- [x] Excel to PDF
- [x] PowerPoint to PDF
- [x] PDF to Word prototype, selectable text only
- [ ] PDF to Word production, layout fidelity and scanned PDFs
- [x] PDF to Excel prototype, selectable text only
- [ ] PDF to Excel production, table fidelity and scanned PDFs
- [x] PDF to PowerPoint prototype, selectable text only
- [ ] PDF to PowerPoint production, slide/layout fidelity and scanned PDFs

V2 premium/advanced:
- [ ] batch conversion
- [ ] larger file limits
- [ ] priority worker queue
- [ ] higher-fidelity conversion modes

### Public Category — Convert from PDF

- [x] PDF to Word prototype, selectable text only
- [ ] PDF to Word production, layout fidelity and OCR for scanned PDFs
- [x] PDF to Excel prototype, selectable text only
- [ ] PDF to Excel production, table fidelity and OCR for scanned PDFs
- [x] PDF to PowerPoint prototype, selectable text only
- [ ] PDF to PowerPoint production, slide/layout fidelity and OCR for scanned PDFs
- [x] PDF to image
- [x] PDF to JPG
- [x] PDF to PNG

### Public Category — Convert to PDF

- [x] Word to PDF
- [x] Excel to PDF
- [x] PowerPoint to PDF
- [x] Image to PDF
- [x] JPG to PDF
- [x] PNG to PDF
- [x] Markdown to PDF

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
- [x] Word to PDF
- [x] PDF to Word prototype, selectable text only
- [ ] PDF to Word production, layout fidelity and scanned PDFs
- [x] Excel to PDF
- [x] PDF to Excel prototype, selectable text only
- [ ] PDF to Excel production, table fidelity and scanned PDFs
- [x] PowerPoint to PDF
- [x] PDF to PowerPoint prototype, selectable text only
- [ ] PDF to PowerPoint production, slide/layout fidelity and scanned PDFs

Technologies:
- [x] LibreOffice headless
- [ ] dedicated worker pool

Notes:
- [ ] Do not run LibreOffice inside request handlers.
- [x] Add this only after the upload/job/worker pipeline is stable.
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
- [x] Public homepage presents the real beta: Guest access is immediate, signing in opens Studio for durable documents and version history, and unavailable tools are marked Coming soon. Billing remains deferred.
- [x] LibreOffice headless conversion base exists for Office to PDF.
- [x] Word to PDF uses the shared upload/job/download pipeline.
- [x] Excel to PDF uses the shared upload/job/download pipeline.

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

### Studio Product Rule

- [x] Studio is the product cockpit: keep the current interface direction and make each block real progressively.
- [x] Public tools feed Studio, then Studio becomes the workspace where documents are edited, reviewed, routed, and tracked.
- [x] Public tools should finish inside Guest Studio whenever possible: result ready, obvious download, then next document actions.
- [x] Do not delete the existing Studio sections just because they are early; convert them into real modules one by one.
- [x] Avoid hardcoded operational metrics once a real source exists.
- [x] Every visible Studio action must eventually open a real Studio view, launch a real action, or connect to a real backend contract.
- [x] Never block the first download behind account creation; account prompts must be value-based, not a gate.
- [x] Studio tool categories must not link back to public SEO tool pages; they open a Studio-native flyout next to the sidebar and Studio-native upload flows.
- [x] Keep the Studio tool rail visible on dashboard and document views. Every category and planned tool remains discoverable; unavailable tools are disabled with an explicit `Coming soon` or `Premium later` label instead of being silently removed.
- [x] The Studio import buttons open the native Studio upload dialog and send a PDF directly into the Guest editor, without routing through the public homepage.
- [x] When no active/compatible file exists, the selected Studio tool opens upload inside Studio, then returns to Guest Studio with the result.
- [x] When the Studio canvas shows a PDF source for a non-PDF result, PDF page actions may run from that source instead of the result.

### Access, Persistence, And Plan Policy

- [x] Treat authentication, document persistence, and commercial entitlement as three independent concerns.
- [x] Authentication states are `guest` and `authenticated`.
- [x] Document persistence states are `temporary` and `durable`.
- [x] Future plan states are `free`, `pro`, and later `team`; Guest must not be used as a synonym for Free.
- [x] During the pre-account phase, Guest users can use every currently functional Studio tool on the active compatible document.
- [x] Guest means temporary storage and no durable history, not a reduced toolset.
- [x] A compatible active document should be reused by Studio tools without requiring another upload, regardless of authentication state.
- [ ] Once accounts exist, centralize tool access and limits behind capability checks such as `canUseTool`, `canSaveDocument`, and `canProcessLargeFiles`.
- [ ] Enforce entitlements and quotas on the server; UI locks and upgrade prompts only explain server-backed policy.
- [ ] Add Free/Pro restrictions only after authentication, ownership, durable save, and billing foundations exist.
- [x] Keep the first download available without requiring signup or payment.

### Current Studio Reality Check

Real today:
- [x] Studio route exists in every supported language.
- [x] Public tool jobs can appear as recent Studio documents during the current server session.
- [x] Completed temporary results can be downloaded from Studio before expiration.
- [x] The selected document side panel shows source, action, result state, and retention rule.
- [x] Completed PDF job results can be previewed inline in Studio while the temporary result still exists.
- [x] PDF source files can be previewed for completed conversions whose result is not a PDF, while the source upload still exists.
- [x] Studio already has the foundation for a temporary guest document result.
- [x] Browser editor can rotate selected page ranges with a visual preview and 90°, 180° or 270° controls; thumbnails retain a quick 90° action.
- [x] Browser editor supports visual multi-selection in thumbnails for grouped page deletion or extraction.
- [x] Studio PDF merge accepts multiple additions, makes the active document order explicit, and supports drag-and-drop reordering or removal before processing.
- [x] Studio PDF split exposes every-page, interval and range modes with contextual controls and an output summary before processing.
- [x] Studio PDF compression exposes size, balanced and quality profiles with clear trade-off guidance before processing.
- [x] Studio protect/unlock flows make password handling transparent with reveal controls, confirmation, strength guidance and a no-retention reminder.
- [x] Protected PDFs remain downloadable and available to the unlock flow after saving; Studio does not present their password-gated preview as a missing file.
- [x] Studio tool dialogs use consistent action titles, guarded close behavior, keyboard focus trapping, and accessible progress and error announcements.
- [x] Browser editor thumbnails can reorder PDF pages with drag-and-drop and create a new PDF result.
- [x] Browser editor can place text and visual signature annotations, then flatten them into a new PDF result.
- [x] Browser editor can insert uploaded PDF pages while preserving the current unsaved page order/rotation/annotation plan.
- [x] Empty Studio dashboards show real empty states instead of demo documents.
- [x] Guest temporary results can be saved into a local durable workspace document.
- [x] Saved workspace documents have durable local preview/download routes.
- [x] Saved workspace documents can be reused as sources for follow-up jobs and editor actions, local adapter V1.

Not real yet and should not be presented as active product value:
- [ ] production persistent workspace backed by cloud DB/object storage
- [ ] user accounts
- [x] automatic redirect from completed public tools into Guest Studio
- [x] reopening a public-tool result from Studio history still shows Guest Studio until it is saved to a real workspace
- [ ] guest-session document state beyond the current server session
- [x] continue-with-this-file chained actions from Studio, local temporary-result V1
- [ ] team members
- [x] durable workspace storage usage, local adapter V1
- [ ] real inbox count
- [ ] real approvals count
- [ ] real automation rate
- [ ] email inbox ingestion
- [ ] API upload credentials
- [ ] settings
- [ ] workflow builder
- [ ] activity trail from database
- [ ] saved text/signature styles and reusable signature assets
- [ ] OCR/extracted data from real documents

Build:
- [x] Studio shell and dashboard prototype
- [x] mock recent documents
- [x] remove mock recent-document fallback from the production Studio dashboard
- [x] real recent jobs, local in-memory V1
- [x] real recent documents generated from public tool jobs, local in-memory V1
- [x] download previous results before expiration, local in-memory V1
- [x] connect sidebar buttons to real Studio views
- [x] connect top actions: import, automate, search
- [x] replace hardcoded KPI cards with real local computed metrics while waiting for DB
- [x] connect quick actions: Email inbox, API upload, Rules
- [x] remove internal/debug labels such as "real data" from the customer UI
- [x] show real PDF preview in selected-document panel
- [x] add hover/full-text handling for truncated selected-document values
- [x] fix action button/icon spacing in the selected-document panel
- [x] document rows open a real Studio document workspace route
- [x] add browser-editor shell with tool rail, top toolbar, page thumbnails, document canvas, and signature choice modals
- [x] connect PDF.js viewer with rendered pages, real thumbnails, active page state, and zoom controls
- [x] redirect completed public tool jobs to a selected Guest Studio document route
- [x] make the Studio document result view the default post-processing screen for public tools
- [x] show primary download, expiration, and next suggested actions in the Guest Studio result view
- [x] chain quick actions from Studio without requiring re-upload when a temporary PDF result exists
- [x] Studio tool rail opens categorized Studio-native flyout menus instead of SEO pages
- [x] Studio launcher groups tools by the product catalogue: Convert from PDF, Convert to PDF, Compress, Organize/Edit, Secure/Sign, Images, OCR/AI
- [x] Studio upload modal starts supported tools without leaving the Studio surface
- [x] thumbnail actions run real PDF jobs for extract selected page, rotate selected page, and delete selected page
- [x] thumbnail drag-and-drop runs a real PDF reorder job
- [x] connect browser-editor action controls to real page-operation/annotation state
- [x] empty Studio dashboard states use real empty UI instead of fake documents
- [x] persistent recent documents backed by local workspace records
- [x] durable result storage for saved local workspace documents
- [x] delete file from workspace with explicit confirmation and full version cleanup
- [ ] billing status
- [ ] saved signature later
- [x] approvals route first view
- [x] workflow route first view
- [ ] workflow builder first version
- [ ] OCR/extracted data panel
- [ ] audit trail backed by database

### Studio Roadmap By Feature

#### Studio 0.1 — Navigation And Real Document Detail

Goal: keep the current Studio surface and make the visible document workflow real.

- [x] sidebar navigation opens real Studio views: Documents, Inbox, Workflows, Approvals, AI, Team, Settings
- [x] keep Documents as the first active workspace view
- [x] clicking a document opens/updates a real document detail work area
- [x] document click opens `/studio/documents/[documentId]` as the base for the browser editor/workbench
- [x] show real PDF preview for completed PDF jobs
- [x] show metadata for non-PDF results
- [x] make search work on the real recent document list
- [x] replace hardcoded KPI cards with real local counts while waiting for DB
- [x] quick actions navigate to their real module views
- [x] workflows section opens the Workflow view/detail
- [ ] activity section opens the Activity/Audit view once events exist
- [x] keep a clear Studio/sign-in entry in public navigation without blocking Guest access
- [x] make every truncated field reveal the full value on hover and with native title text
- [x] fix selected-document action layout so icons and labels never overlap

Definition of done:
- [ ] a user can navigate through the Studio sections without dead clicks
- [ ] document selection shows useful real detail
- [ ] PDF jobs show real preview where possible
- [ ] no Studio metric stays hardcoded when a local source is available
- [ ] desktop and mobile layouts have no overlap

#### Studio 0.2 — Document Preview

Goal: show the actual document/result content, not a decorative paper placeholder.

- [x] add result preview endpoint for completed PDF jobs
- [x] add source preview endpoint when the uploaded source is still available
- [x] render PDF pages in-browser using PDF.js or a stable PDF viewer layer
- [x] show inline PDF result preview in the selected-document panel
- [x] show PDF source preview for PDF to Word/Excel/PowerPoint when the result is not previewable as PDF
- [x] add loading and expired/unavailable preview states in the editor view
- [ ] add unsupported-file and failed-job preview states everywhere preview is shown
- [x] keep non-PDF previews simple: file icon, metadata, download link

Definition of done:
- [x] clicking a completed PDF job shows a real visual preview
- [ ] expired files show a clear message
- [ ] preview does not block downloads

#### Studio 0.3 — Search And Filters

Goal: make Documents navigable once there are many jobs.

- [x] search by file name
- [x] filter by status: queued, processing, completed, failed
- [ ] filter by action/category: compression, conversion, organize, security
- [ ] sort by newest, oldest, size, status
- [ ] keep search local first, then move to database query later

Definition of done:
- [x] search input actually filters visible documents
- [x] filters do not require a page reload
- [x] empty states are clean and useful

#### Studio 0.4 — Browser Editor Shell

Goal: make Studio feel like a real document editor before wiring every advanced action.

Already done:
- [x] document workspace route opens an editor-style surface
- [x] left tool rail for Compress, Convert, Organize, Edit, Sign, AI, More, Documents
- [x] top document header with back, save, download, share, and finish actions
- [x] horizontal editor toolbar with selection, hand, signatures, text, date, validation, undo, redo, search controls
- [x] page thumbnail column
- [x] collapsible page thumbnail layer so the canvas can use more space
- [x] collapsible Guest Studio result panel so preview/zoom keeps enough space
- [x] central document canvas with inline PDF preview when available
- [x] floating page/zoom controls
- [x] signature modal flow: choose signer, then choose seal type
- [x] disabled/premium states for actions that are not wired yet

Completed after the initial shell:
- [x] PDF.js rendering layer instead of iframe-only preview
- [x] real page selection state
- [x] real zoom in/out from 10% to 1000%
- [x] calibrated 100% zoom against the canvas width and height so oversized/scanned PDFs open in a fit-page view
- [x] real thumbnail rendering from PDF pages
- [x] all PDF pages rendered in the main canvas with internal document scrolling
- [x] independent canvas scrolling so zoom/pan does not scroll the whole Studio layout
- [x] collapsible page thumbnail layer, with a compact reopen control
- [x] extract, rotate, and delete a selected page from thumbnail actions
- [x] thumbnail page actions stay visible for editable PDF results even while the PDF preview is loading or in fallback
- [x] completed PDF jobs store their real page count for the Studio page layer
- [x] drag-and-drop page reorder, V1 creates a new PDF result immediately
- [x] page drag-and-drop reorders correctly in both upward and downward directions
- [x] page actions can target the original PDF source when the visible preview is source-only after PDF to Office conversion
- [x] place text and visual signature annotations
- [x] save edited PDF result back to a temporary job result
- [x] insert pages from the editor and preserve the current unsaved page plan
- [ ] date and image annotations
- [x] save edited PDF result back to a durable workspace document with immutable versions
- [ ] saved signatures and verified seal flow

Definition of done:
- [x] a user can open a PDF and see real page thumbnails
- [x] selecting a thumbnail scrolls the main canvas to that PDF page
- [x] scrolling the PDF updates the active page indicator
- [x] zooming and panning stay inside the document canvas
- [x] 100% zoom is visually calibrated as fit-page for the editor canvas, not raw PDF.js scale
- [x] page thumbnail layer can be hidden and reopened without leaving the editor
- [x] Guest Studio result panel can be hidden and reopened without losing download access
- [x] selected page actions create a new processed Studio result
- [x] editable PDF results expose extract, rotate, and delete controls in the page layer before thumbnail rendering finishes
- [x] dragging a thumbnail before another page creates a reordered PDF result
- [x] editor buttons either perform a real action or show a clearly disabled/premium state
- [ ] no editor area overlaps on desktop, tablet, or mobile

#### Studio 0.45 — Guest Studio Funnel

Goal: turn every completed public tool into a Studio entry point without blocking download.

Flow:
- [ ] Google or direct visit opens a public tool page such as `/compress-pdf`
- [ ] user uploads and processes the file without account creation
- [x] completed job creates or links a temporary guest document
- [x] user is redirected to `/studio/documents/[documentId]` with that document selected
- [x] Studio shows the result first: preview, before/after metadata, expiration, and a large download action
- [x] Studio suggests natural next actions for the same file
- [x] quick next actions reuse the current PDF result as input without re-upload
- [x] account prompt appears only as an optional save-history/save-document value proposition
- [x] returning to the same temporary job from Studio history keeps the Guest Studio state
- [ ] clearly label the editor as Guest/temporary before account creation
- [ ] allow all currently functional Studio tools to operate on the active compatible Guest document
- [ ] keep Guest edits available only for the temporary session and cleanup window
- [ ] warn before leaving when unsaved Guest work would become unavailable
- [x] Bind temporary uploads, jobs, previews, downloads, follow-up tools, Studio lists/details and save requests to an HttpOnly browser-session cookie.
- [x] Add a close endpoint that revokes the temporary tool chain and removes completed result files; late-running jobs remove their results on completion.
- [x] Preserve the temporary chain during Studio tool transitions; show a leave confirmation on editor navigation links and a browser warning for full-page exits.
- [x] Add tab membership for temporary chains: releasing one tab does not revoke another; internal tool transitions transfer membership.
- [x] Replace native link-exit confirms with an accessible dialog and guard single-step browser back navigation.
- [x] Browser QA: confirmed link exit, cancelling a browser-back exit, downloading without leaving, continuing a tool in a second tab after the first leaves, and unavailable-document handling.
- [ ] Complete cross-browser QA for refresh, forward navigation, multiple-entry history jumps and interrupted connections; close delivery remains best-effort with TTL fallback.
- [ ] Move temporary job/session state out of process memory before multi-instance production deployment; add scheduled physical cleanup independent of incoming requests.

Session lifecycle note: uploaded sources retain their existing 15-minute cleanup window; results expire after six hours even if the close signal is lost. Expired access is refused at read time. Physical cleanup runs on requests or the protected maintenance endpoint; its production schedule is not activated. Browser close signals are best-effort, not a guarantee of immediate deletion. Closing the last registered tab revokes the chain; a crashed tab can retain membership until expiration. Signing out revokes that browser session's temporary jobs. Job and Guest state now survive restarts on the same persistent volume with a single writer. Multi-instance storage and production restart QA remain pending.
- [ ] after account creation and save, convert the temporary guest document into a durable workspace document

Definition of done:
- [x] a user can complete Compress PDF and land in Guest Studio with the finished result selected
- [x] download is immediately visible and does not require email, login, or signup
- [x] temporary file expiration is clear
- [x] at least three "continue with this file" actions are visible and correctly routed
- [x] the flow works in every supported locale
- [x] no fake workspace persistence is implied for guest users
- [ ] Guest status is visible without requiring the user to infer it from missing version history
- [x] saved workspace documents no longer show Guest Studio as the primary state

#### Studio 0.46 — Studio Tool Launcher

Goal: make the Studio rail a real hover launcher, not a shortcut back to SEO pages.

Flow:
- [x] hovering a Studio rail category opens a flyout immediately to the right of the sidebar
- [x] launcher flyouts stay compact: icon + tool name only, no explanatory header, no category intro, no close CTA
- [x] category buttons remain usable by click/focus for keyboard and touch users
- [x] Convert category includes Convert from PDF and Convert to PDF tools
- [x] Compress panel includes Compress PDF and Compress image
- [x] Organize/Edit tools are grouped by the same catalogue logic used in the public footer
- [x] Secure/Sign tools stay in the secure/sign category
- [x] Protect PDF and Unlock PDF open Studio-native password forms and run inside Studio
- [x] OCR/AI tools are visible but marked as coming soon or premium later until engines exist
- [x] tools with a compatible active document can reuse that document without re-upload
- [x] tools without a compatible active document open a Studio upload modal instead of a public SEO page

Still to build:
- [x] option forms on the active document for watermark (text, position, opacity), extraction, and deletion by typed page ranges
- [x] watermark options now preview directly on the active PDF and preserve selected color, size, position, and opacity in the generated file
- [x] reuse the active PDF as the first merge input; upload only the additional PDFs, for Guest and durable documents
- [x] chained tools use the compatible current result, including Office conversion outputs
- [x] apply pending PDF editor changes before automatic tools and page-range/watermark operations
- [ ] apply pending edits automatically before merge and password tools; currently require Save/Finish first
- [x] visual editor launch for reorder, insert pages, add text, and signature placement
- [ ] visual editor launch for fill PDF
- [ ] multi-file Studio upload ordering for merge/insert pages
- [ ] complete option-tool upload flows when no compatible document is active
- [x] Studio-native version history with preview, download, and non-destructive restore

Definition of done:
- [x] no Studio tool category sends the user to a public SEO page
- [ ] every supported no-editor tool can run from Studio upload
- [x] every unsupported/future tool clearly shows disabled, coming soon, or premium state
- [ ] desktop and mobile launcher layouts have no overlap

#### Studio 0.47 — Editor History And Save

Goal: make the editor behave like a real work surface before advanced annotations.

- [x] local edit state for unsaved page operations
- [x] Undo reverts the last unsaved operation
- [x] Redo reapplies the last reverted operation
- [x] keyboard shortcuts: Cmd/Ctrl+Z and Cmd/Ctrl+Shift+Z
- [x] disabled Undo/Redo buttons when no matching history exists
- [x] Save/Finish applies the queued operations and creates one new PDF result

Definition of done:
- [x] a user can reorder, rotate, delete, then undo before saving
- [x] the original job/result stays intact until Save/Finish
- [x] buttons are not decorative: active controls perform actions, unavailable controls are clearly disabled

#### Studio 0.48 — Canvas Text And Signature Annotations

Goal: make the first visible editor tools usable directly on the PDF canvas.

- [x] toolbar Text activates a canvas placement mode
- [x] Sign without seal activates a canvas signature placement mode
- [x] placed text annotations are visible on the PDF canvas
- [x] placed visual signatures are visible on the PDF canvas
- [x] annotations participate in the same local unsaved editor state as page operations
- [x] Undo/Redo can remove or reapply annotation placement
- [x] Save/Finish flattens text and visual signatures into the generated PDF

Still to build:
- [ ] signature drawing/import UI instead of placeholder signature text
- [x] date field placement as editable text, with localized numeric/long/ISO format and PDF export (2026-10-05)
- [ ] image placement
- [ ] saved signatures for logged-in users
- [ ] certified signature/seal flow

Definition of done:
- [x] a user can click Text, place text on a PDF page, edit the text, then save a new PDF
- [x] a user can choose Sign without seal, place a visual signature, then save a new PDF
- [x] annotations are visible before save and included in the downloaded PDF result

#### Studio 0.49 — Annotation Controls

Goal: make placed annotations feel editable instead of fixed placeholders.

- [x] selected annotations show compact canvas controls
- [x] text annotations can be moved after placement
- [x] visual signature annotations can be moved after placement
- [x] text annotations can be resized after placement
- [x] visual signature annotations can be resized after placement
- [x] selected text annotations expose font family, size, color swatches, bold, alignment, duplication, and deletion; the exported PDF preserves those choices
- [x] text edits commit into editor history on blur
- [x] move/resize gestures commit into editor history on pointer release
- [x] Undo/Redo works after annotation movement and resizing

Still to build:
- [ ] snap guides/alignment helpers
- [ ] keyboard nudging with arrow keys
- [ ] style controls for text size, color, weight, and alignment
- [ ] signature drawing/import UI instead of placeholder signature text

Definition of done:
- [x] a user can place text, move it, resize it, undo it, then save the final PDF
- [x] a user can place a visual signature, move it, resize it, undo it, then save the final PDF

#### Studio 0.5 — Durable Workspace

Goal: let logged-in users return and find previous work.

- [x] choose V1 local durable adapter for development: filesystem metadata plus `.tmp/workspace/files`
- [x] choose production database: Supabase Postgres
- [x] choose production object storage: Supabase Storage
- [x] document required Supabase env vars and schema
- [x] add Supabase workspace adapter, selected by `WORKSPACE_STORAGE_DRIVER=supabase`
- [x] create workspace document records, local adapter V1
- [ ] create job records
- [x] persist result metadata for saved workspace documents, local adapter V1
- [ ] persist user ownership
- [ ] persist expiration state
- [x] convert a guest temporary result into a saved workspace document without requiring reprocessing, local adapter V1
- [x] change saved documents from Guest Studio panel to durable workspace state
- [x] add durable preview/download routes for saved workspace documents
- [x] add delete document/result for local and Supabase workspace storage
- [ ] add saved vs temporary distinction
- [x] show explicit `Temporary document` or `Saved in Studio` state beside the document title
- [x] replace the retractable Guest result panel with a compact header status and expiration; keep the side panel for durable version history
- [x] allow saved workspace documents to become the source for follow-up jobs and editor actions, local adapter V1
- [x] preserve saved-workspace state after editing a saved document instead of returning to Guest Studio
- [x] append immutable document versions while keeping preview/download on the current version
- [x] list, preview, download, and restore saved document versions in Studio

Definition of done:
- [ ] logged-in users can leave and return to their documents
- [ ] temporary public jobs remain temporary
- [x] saved workspace documents survive dev server restarts with the local adapter
- [x] saved workspace documents can launch follow-up jobs with the local adapter
- [ ] saved workspace documents survive production deploys with configured Supabase project
- [x] apply the document versions schema migration to the production Supabase project

#### Studio 0.6 — Accounts, Teams, Settings

Goal: make Studio a real workspace, not only a recent jobs page.

- [x] add Supabase Auth
- [x] Implement server-side email-code signup/login, verified user reads, HttpOnly session cookies, refresh proxy and logout.
- [x] Use a Supabase Magic Link callback with a cross-device handoff so the original Guest Studio page receives its own HttpOnly session after the e-mail link is confirmed.
- [x] Add a compact account dialog in Studio without leaving the active editor; saving can resume after login, including pending edits.
- [x] Require a verified account for durable saves; scope lists, details, previews, downloads, versions, restore, deletion and tool sources to its user id.
- [x] Prepare the ownership migration with owner-only read policies; retain unowned legacy records without exposing or auto-claiming them.
- [x] Add automated auth and cross-account route tests; isolate test storage from development files.
- [x] Share temporary job/session state between server-rendered pages and route handlers within one server process; no claim of multi-instance persistence.
- [ ] Activate on the real Supabase project: publishable key, ownership migration, cross-device handoff migration, email-code templates and SMTP configuration.
- [x] Add the project's actual publishable key to the ignored local environment file.
- [x] Apply the ownership migration to Supabase after confirmation (2026-09-24). Verified the UUID owner column, RLS on both tables, exactly two policies, denied anonymous reads and denied direct authenticated writes.
- [ ] Configure an email delivery provider and OTP templates. The project's Free dashboard currently requires custom SMTP (or a Pro upgrade) to edit template subjects and bodies; no provider or paid upgrade has been configured.
- Email setup is pending: the owner confirmed on 2026-09-24 that no domain or email delivery service is available yet. Real email-code login remains unvalidated.
- [ ] Validate real email delivery, refresh/logout and Guest-to-owned save with two accounts before marking Auth complete.
- [ ] add user profile
- [ ] associate durable documents with `user_id`
- [ ] convert the active Guest document into an owned durable document after signup/login without reprocessing
- [ ] preserve the active editor context during the Guest-to-account transition
- [ ] define plans independently from authentication: `free`, `pro`, later `team`
- [ ] add a centralized server-side capability and entitlement service
- [ ] add server-enforced quotas for file size, processing count, storage, and premium tools
- [ ] keep all currently functional tools available to Guest users until the entitlement system is live
- [ ] organization/workspace model
- [ ] team invite
- [ ] roles: owner, admin, member, viewer
- [ ] settings page
- [ ] billing status surface
- [ ] usage/quota page

Definition of done:
- [ ] a user can own a workspace
- [ ] a Guest can create an account and retain the active document without uploading or processing it again
- [ ] Guest, Free, and Pro are represented as distinct states throughout API and UI code
- [ ] no paid restriction depends directly on `isGuest`
- [ ] capability decisions are enforced by the server and consistently reflected in the UI
- [ ] a team can share documents
- [ ] settings and billing show real data

#### Studio 0.7 — Activity And Audit Trail

Goal: track what happened to each document.

- [x] create server-generated activity event model with document/job/tool, timestamp and owned user scope
- [x] record imported: file accepted into a new processing flow, not upload start or a rejected upload
- [x] record job created and processing completed/failed; capture owned-document tool runs as well as temporary Guest jobs
- [x] record download requested only after authorization and result-file read; this does not prove the browser finished saving the file
- [x] record saved to workspace and new document versions
- [x] record restored version with the newly created version number
- [x] record deleted after successful deletion; retain the minimal owner-only event without file contents or file paths
- [x] show selected-document activity through a compact Studio dialog, including Guest documents
- [x] replace dashboard status-derived activity with the owner's actual recent events
- [x] local activity persists on disk; Guest events share temporary job expiry/revocation; Supabase adapter and owner-only SQL migration prepared
- [x] automated coverage for processing outcomes, save/version/restore/download/delete, account isolation, ordering, bounded reads and unavailable storage
- [x] Apply `docs/supabase_workspace_activity.sql` on the configured Supabase project (5 October 2026): transactional execution succeeded; catalog checks confirm RLS enabled, one owner-select policy, no anonymous read, no authenticated client insert, and service-role insert allowed
- [ ] Verify owner-only access with real accounts; deferred at the owner's request on 5 October 2026
- [ ] Validate durable activity after reconnect/restart against the real Supabase project
- [ ] Define durable activity retention and add durable replay/outbox for events missed during storage outages; a failed activity write currently logs a sanitized operational failure without failing the completed file action
- [ ] Extend interrupted-worker recovery reporting to the durable workspace feed; Guest recovery reports the interruption in its persisted job activity

Local validation, 5 October 2026: import/process activity and a real download
request checked in the browser; old documents have no invented event history.
Desktop and mobile activity layouts checked without browser console errors.
Full suite: 265 passed, one conditional skipped; TypeScript and production build passed. Supabase
migration was applied on 5 October 2026 to the configured Foliant project;
real-account and reconnect checks remain deferred, not passed. This is a V1 activity log, not a certified or
tamper-proof audit trail. Guest history is capped at 100 recent chain events;
the displayed durable feed is capped at 40 events (100 maximum for server reads).

Definition of done:
- [x] activity is generated by real server actions, not client-submitted events
- [x] owned activity is linked to document, job where applicable, verified owner and timestamp
- [x] no fabricated activity or historical backfill is displayed
- [ ] durable Supabase activity is activated and verified with real accounts

#### Studio 0.8 — Approvals

Goal: support the first paid team workflow.

Next implementation scope (5 October 2026): a saved document owner requests
approval from another account for a specific immutable version. The recipient
can inspect that version and approve/reject with an optional comment; the owner
can cancel a pending request. Sharing must be explicit and restricted to the
assigned recipient, with server-side access checks and no public document URL.
This does not add premium restrictions to existing Guest tools. Inbox,
automation and email notifications remain separate later work.

- [x] Pin requests to an immutable document version; later edits cannot change what was approved
- [x] Add dedicated owner/assigned-recipient authorization without granting workspace-wide access
- [x] Enforce pending-to-approved/rejected/canceled transitions atomically and reject concurrent or repeated decisions

- [x] approval request model
- [x] status: pending, approved, rejected, canceled
- [x] assign approver
- [x] approve/reject actions
- [x] approval comments
- [x] document detail approval timeline
- [x] approvals list page
- [ ] email notification later

Validation technique (6 octobre 2026) : migration Supabase appliquée ; RLS et
permissions contrôlées dans le catalogue distant. Migration et scénarios SQL
testés sur PostgreSQL local, y compris concurrence, isolation et réapplication.
Les 12 tests ciblés Approbations/Activité passent, ainsi que TypeScript.
Validation globale du 9 octobre : 27 fichiers de tests, 272 tests réussis et
un test conditionnel ignoré. Le timeout XLSX précédent ne s'est pas reproduit.
Build Next.js de production et contrôle TypeScript réussis dans une copie
isolée sans secrets, sans interrompre le serveur de développement.
- [x] Vérifier sur Brave bureau deux sessions distinctes, l'enregistrement du PDF neutre, la demande, sa réception et l'aperçu en lecture seule (9 octobre 2026).
- [x] Vérifier l'interface connectée en émulation mobile Brave 390 × 844 : liste peuplée, formulaire propriétaire, aperçu, commentaire, confirmation et décision enregistrée (9 octobre 2026). Téléphone physique non testé.
- [x] Vérifier l'écran Guest à 360 et 390 px sans débordement, et le refus d'accès à une demande privée sans connexion (9 octobre 2026).
- [x] Vérifier le parcours complet avec deux comptes réels, sans partager les documents personnels de test (Brave, 9 octobre 2026).
  Demande sur la version 1 de `light-reordered.pdf` envoyée depuis le premier
  compte, reçue et approuvée avec commentaire « test » depuis le second compte
  en fenêtre privée. Statut Approved et disparition des commandes de décision
  confirmés. Retour côté propriétaire et commentaire vérifiés ; rechargement
  complet conservant la décision confirmé. Deux autres demandes sur le même
  PDF neutre ont permis de vérifier refus avec commentaire et annulation.
  La demande annulée retire l'aperçu et les décisions côté destinataire.
  L'accès direct du destinataire à la route d'édition du document propriétaire
  est refusé (« Document not found »). Aucun document personnel n'a été partagé.
  Les demandes terminées approuvées/refusées gardent leur accès de lecture dédié ;
  annuler une autre demande ne révoque pas ces accès historiques.
- [x] Vérifier en navigateur une modification du document après demande : rotation et sauvegarde en version 2 du PDF neutre ; aperçu historique côté destinataire toujours sur la version 1 non pivotée (Brave, 9 octobre 2026).
- [x] Valider le build de production pour ce lot (9 octobre 2026, copie isolée sans fichiers d'environnement).

Definition of done:
- [x] one user can request approval (real account, neutral test PDF, 2026-10-09)
- [x] another user can approve or reject (both real-account paths verified, 2026-10-09)
- [x] approval history remains attached to the document (owner list, comment and reload verified, 2026-10-09)

#### Studio 0.9 — Workflow Builder

Goal: turn documents into operations.

- [x] Workflow model V1 : règles privées, cinq par compte, consentement au partage obligatoire et pause/reprise.
- [x] Trigger V1 : nouveau document enregistré dans le workspace ; pas un simple upload Guest ni une nouvelle version.
- [x] Conditions V1 : PDF uniquement, outil source compatible et taille maximale facultative.
- [ ] Conditions supplémentaires : statut et champs extraits.
- [x] Action V1 : demander une approbation sur la première version enregistrée, à un compte vérifié distinct du propriétaire.
- [ ] Actions supplémentaires : déplacer, notifier, exporter.
- [x] Workflow list page : formulaire sans code, état actif/en pause, historique, quatre langues.
- [x] Workflow detail page : règle et historique filtré, accès propriétaire uniquement.
- [x] Run log : succès, échec et conditions non remplies ; réservation unique avant partage pour éviter les doublons.
- [x] Disabled AI workflow creation placeholder until AI is ready.
- [x] Appliquer `docs/supabase_workspace_workflows.sql` au projet Supabase (10 octobre 2026, Safari SQL Editor, résultat « Success. No rows returned »). Migration aussi validée deux fois sur PostgreSQL local isolé : limite, RLS, permissions et unicité. Liste/historique et ouverture du formulaire vérifiés sur un compte réel sans activer de règle.
- [x] Valider une règle réelle avec deux comptes et un PDF neutre : déclenchement unique, approbation de V1 après sauvegarde de V2, isolation règles/journal ; règle de test laissée en pause (10 octobre 2026).
- [x] Coder modification/archivage : nouveau consentement, filtres préremplis, conservation de l’historique, arrêt des futures exécutions, cinq règles non archivées maximum. Tests locaux et interface isolée validés le 10 octobre 2026.
- [x] Appliquer `docs/supabase_workspace_workflow_management.sql` et valider modification/archivage sur le compte réel (10 octobre). Succès SQL confirmé ; colonnes et droits vérifiés. Dans Safari, règle QA modifiée (nom, seuil de 0.02 à 0.03 Mo, maintien en pause), relue puis archivée ; une exécution historique conservée. Aucun document personnel modifié. Filtre archives vérifié localement, pas revalidé sur le navigateur réel dans cette recette.
- [x] Ajouter une file durable hors du chemin de sauvegarde, avec approbation et journal atomiques sur Supabase ; migration appliquée le 10 octobre, reprise et workers concurrents testés localement.
- [ ] Activer et superviser le worker indépendant ; compléter la recette réelle après redémarrage.
- [x] Tester le vrai script worker et deux arrêts brutaux de PostgreSQL local avec un PDF neutre ; reprise unique même après perte de réponse HTTP (11 octobre, interface de QA isolée).
- [x] Rendre fiable le premier enregistrement suivi de l'enqueue sur Supabase, sans balayage rétroactif des documents privés : RPC transactionnelle appliquée le 11 octobre, rollback et retry vérifiés localement.
- [x] Clôturer la recette fonctionnelle V1 après ajout de la file : deux comptes réels, approbation unique de V1 et décision enregistrée, règle QA archivée, journal conservé, isolation des listes et archives (11 octobre). Worker permanent et redémarrage sur hébergement différés au lancement.

Definition of done:
- [x] A simple no-code rule can run on new documents (tests locaux et exécution Supabase réelle avec deux comptes, 10 octobre 2026).
- [x] Successful approval requests appear in document activity through the existing approval module; all workflow outcomes appear in the execution history.
- [x] Failed workflow runs expose safe reason codes, without provider errors or automatic sharing retries.

Validation locale du 10 octobre 2026 : onze tests spécifiques automatisations et
sauvegarde passent ; suite complète : 283 réussis, un ignoré. TypeScript et build
de production passent. Formulaire contrôlé
sur une copie isolée avec compte fictif, bureau et viewport mobile 390 × 844 ;
consentement obligatoire et absence de débordement vérifiés. Pas une validation
d'authentification réelle ni une recette Supabase complète. La migration et le
chargement réel dans Safari ont ensuite été validés. Après consentement explicite,
une règle ciblée sur les PDF pivotés de moins de 0,02 Mo a créé une approbation
sur V1 du PDF fictif `light.pdf`. Le destinataire connecté dans Brave a approuvé
V1 après sauvegarde de V2 ; ses règles et son journal restent isolés. Une seule
exécution est visible après rechargement ; règle laissée en pause. La sauvegarde
V2 a été testée avec la règle déjà en pause : absence de déclenchement V2 sous
règle active et reprise restent couvertes localement, pas par cette recette.
Détails et limites dans
`docs/WORKFLOWS_QA.md`.

#### Studio 1.0 — OCR And Extracted Data

Goal: make Studio worth paying for beyond public PDF utilities.

- [ ] OCR PDF engine
- [ ] image to text engine
- [ ] document type classification
- [ ] extracted fields model
- [ ] extracted data panel in selected-document view
- [ ] confidence score
- [ ] manual correction UI
- [ ] learned supplier/vendor templates later

Definition of done:
- [ ] scanned documents can produce searchable/extracted text
- [ ] extracted fields are stored and shown in Studio
- [ ] corrections can improve future extraction later

#### Studio 1.1 — Paid Studio MVP

Goal: first version worth charging for.

- [ ] real document workspace
- [ ] real document preview
- [ ] real search/filter
- [ ] real activity trail
- [ ] saved documents
- [ ] quotas
- [ ] Free/Pro entitlement matrix backed by centralized capability checks
- [ ] billing status
- [ ] basic team access
- [ ] first approval flow
- [ ] clear upgrade prompts

Definition of done:
- [ ] Studio has a reason to pay before public paid launch
- [ ] public tools remain the acquisition funnel
- [ ] paid workspace keeps durable value

Phase 7 definition of done:
- [ ] logged-in users can return and find recent activity
- [ ] temporary storage rules remain clear
- [ ] Studio gives users a clear reason to pay before public paid launch

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
- [x] Replace early homepage pricing placeholders with truthful Guest and Studio account messaging; defer billing until it is implemented.
- [x] Add SEO metadata, canonical links, hreflang, sitemap, and robots.txt for public pages.
- [x] Finish Markdown to PDF first version.
- [x] Start Office conversion prerequisites with LibreOffice headless.
- [x] Finish Word to PDF first version.
- [x] Finish Excel to PDF first version.
- [x] Validate PowerPoint to PDF with a reliable PPTX fixture.
- [x] Finish Convert to PDF public category first version.
- [x] Finish PDF to Word selectable-text prototype.
- [ ] Finish PDF to Word production version.
- [x] Finish PDF to Excel selectable-text prototype.
- [ ] Finish PDF to Excel production version.
- [x] Finish PDF to PowerPoint selectable-text prototype.
- [ ] Finish PDF to PowerPoint production version.
- [x] Start Studio MVP architecture.
- [x] Connect public tool jobs to Studio recent documents, local in-memory V1.
- [x] Studio 0.1: turn the current cockpit into routed module views with local computed document state.
- [x] Studio 0.2: add real PDF preview for completed PDF jobs.
- [x] Studio 0.3: make search and basic status filters work on real/recent documents.
- [x] Studio 0.4: add browser-editor shell with tool rail, toolbar, thumbnails, canvas, and signature modals.
- [x] Studio 0.4: connect PDF.js rendering, real thumbnails, active page state, and zoom controls.
- [x] Studio 0.4: render the full PDF in the main canvas with independent scroll and 10%-1000% zoom.
- [x] Studio 0.4: calibrate 100% zoom to the canvas width and height for oversized/scanned PDFs.
- [x] Studio 0.4: make the page thumbnail layer collapsible.
- [x] Studio 0.4: make the Guest Studio result panel collapsible and use source PDF preview for PDF to Office results.
- [x] Studio 0.4 next: connect thumbnail actions for extract, rotate, and delete selected PDF pages.
- [x] Studio 0.45: redirect completed public tools into Guest Studio with result selected and download visible.
- [x] Studio 0.45: add "continue with this file" actions using the current temporary result as input.
- [x] Studio 0.46: replace Studio rail SEO links with categorized Studio-native flyout menus.
- [x] Studio 0.46: add Studio-native upload modal for supported tools when the active file is missing or incompatible.
- [x] Studio 0.4 next: connect real editor actions: place signature/text, reorder pages, insert pages, save edited PDF.
- [x] Studio signature export: generate the current edited PDF before direct download instead of linking to the previous result. Browser click verified to create a signed PDF; its drawing was checked with independent Poppler rendering (2026-10-03).
- [x] Signature drawing performance: paint incremental pointer samples directly on a high-DPI canvas without rerendering the Studio for every movement; commit completed strokes only. Fixed thin stroke, unchanged modal dimensions. Browser checks: drawing, undo/redo, recoloring, placement and deselection (2026-10-03).
- [x] Studio PDF rendering performance: defer offscreen page/thumbnail rasterization, retain completed renders, reserve page aspect ratios and abort obsolete preview downloads. Remove the full-screen modal backdrop blur. Browser check on a 12-page image PDF: only 2 full pages rasterized initially, navigation to page 12 and zoom checked (2026-10-04).
- [ ] Performance follow-up: confirm the reported mouse/scroll lag in the user's Brave session; investigate disabled GPU compositing separately from site regressions. Local guest homepage/Studio server response checks were under 200 ms, not a full end-to-end latency measurement (2026-10-04).
- [x] Studio stabilization: remove demo Recent Documents fallback and add actionable empty states.
- [x] Studio stabilization: make unavailable PDF previews fail gracefully instead of crashing the dev overlay.
- [x] Studio stabilization: hydrate document lists/details on the server and retry transient Supabase reads without flashing false empty or processing states.
- [x] Studio stabilization: keep same-document edits attached to durable documents as new versions while routing derived outputs to Guest Studio.
- [ ] Studio stabilization: run a browser QA pass for public upload to Guest Studio, reorder plus insert, text/signature save, empty dashboard, and expired preview.
- [x] Studio 0.5 V1: connect local durable workspace records and file storage.
- [x] Studio 0.5 production decision: Supabase Postgres/Auth/Storage.
- [x] Studio 0.5 production adapter: Supabase workspace documents/storage behind env flag.
- [x] Studio 0.5 production setup: create Supabase project, run base schema, create private bucket, configure env vars.
- [x] Studio 0.5 production setup: apply the `workspace_document_versions` schema migration.
- [x] Next: make Guest/temporary versus saved/durable status explicit in the editor UI.
- [ ] Next: finish the all-tools-on-current-compatible-document Guest experience before adding commercial restrictions.
- [ ] Then: add Supabase Auth and durable document ownership by `user_id`.
- [ ] Then: preserve the active Guest document during signup/login and save it without reprocessing.
- [ ] Then: add centralized Free/Pro capabilities, server-side quotas, billing, and upgrade prompts.
