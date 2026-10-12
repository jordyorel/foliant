"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import {StudioAccountButton, useStudioAccount} from "@/components/studio/StudioAccount";
import {studioToolCategories, studioToolItems, type StudioToolCategory} from "@/content/studio-tools";
import {type ErrorLabels} from "@/components/uploader/clientError";
import {getAuthCopy} from "@/content/auth";
import {useTranslations} from "next-intl";
import {useEffect, useMemo, useRef, useState} from "react";
import {
  getStudioCopy,
  type StudioDocument,
  type StudioViewKey
} from "@/content/studio";
import {fetchStudioDocuments} from "@/lib/studio/client";
import {StudioActivity} from "@/components/studio/StudioActivity";
import {StudioApprovals} from "@/components/studio/StudioApprovals";
import {approvalCopy} from "@/content/approvals";
import {workflowCopy} from "@/content/workflows";
import {StudioWorkflows} from "@/components/studio/StudioWorkflows";
import {StudioInbox, useInboxCount} from "@/components/studio/StudioInbox";
import {inboxCopy} from "@/content/inbox";

const StudioToolUploadDialog = dynamic(() => import("@/components/studio/StudioDocumentWorkspace").then((module) => module.StudioToolUploadDialog), {ssr: false});

type StudioDashboardProps = {
  initialDocuments: StudioDocument[] | null;
  locale: string;
  view?: StudioViewKey;
};

const navItems = [
  {key: "home", icon: "ti-home"},
  {key: "documents", icon: "ti-files"},
  {key: "inbox", icon: "ti-inbox"},
  {key: "workflows", icon: "ti-route"},
  {key: "approvals", icon: "ti-checkup-list"},
  {key: "ai", icon: "ti-sparkles"},
  {key: "team", icon: "ti-users"},
  {key: "settings", icon: "ti-settings"}
] as const;

const statusFilters = ["all", "active", "completed", "failed"] as const;
const actionFilters = ["all", "compressed", "converted", "organized", "secured", "image"] as const;
const sortOptions = ["name", "size", "status"] as const;

type StatusFilter = (typeof statusFilters)[number];
type ActionFilter = (typeof actionFilters)[number];
type SortOption = (typeof sortOptions)[number];

function selectedFieldsFor(copy: ReturnType<typeof getStudioCopy>, document: StudioDocument, actionLabel: string) {
  if (document.isLive) {
    return [
      {
        label: copy.selected.source,
        value: document.sourceName ?? document.name
      },
      {
        label: copy.selected.action,
        value: actionLabel
      },
      {
        label: copy.selected.result,
        value: document.error ?? (document.resultUrl ? copy.selected.ready : copy.selected.inProgress)
      },
      {
        label: copy.selected.retention,
        value: document.isGuest ? copy.selected.retentionValue : copy.workspace.documentStatus.saved
      }
    ];
  }

  return [
    {
      label: copy.selected.vendor,
      value: copy.selected.vendorValue
    },
    {
      label: copy.selected.amount,
      value: copy.selected.amountValue
    },
    {
      label: copy.selected.due,
      value: copy.selected.dueValue
    },
    {
      label: copy.selected.rule,
      value: copy.selected.ruleValue
    }
  ];
}

function iconFor(document: StudioDocument) {
  if (document.kind === "compressed") return "ti-arrows-diagonal-minimize-2";
  if (document.kind === "converted") return "ti-transform";
  if (document.kind === "organized") return "ti-layout-grid";
  if (document.kind === "secured") return "ti-shield-lock";
  if (document.kind === "image") return "ti-photo";
  return "ti-file-type-pdf";
}

function navHref(locale: string, key: (typeof navItems)[number]["key"]) {
  if (key === "home") return `/${locale}`;
  if (key === "documents") return `/${locale}/studio`;
  return `/${locale}/studio/${key}`;
}

function nextStatusFilter(current: StatusFilter) {
  const index = statusFilters.indexOf(current);
  return statusFilters[(index + 1) % statusFilters.length];
}

function matchesStatusFilter(document: StudioDocument, filter: StatusFilter) {
  if (filter === "all") return true;
  if (filter === "active") return document.status === "queued" || document.status === "processing" || document.status === "review";
  if (filter === "completed") return document.status === "approved" || document.status === "completed" || document.status === "processed";
  return document.status === "failed";
}

function sortDocuments(documents: StudioDocument[], sort: SortOption) {
  return [...documents].sort((left, right) => {
    if (sort === "size") return (right.resultSize ?? right.inputSize ?? 0) - (left.resultSize ?? left.inputSize ?? 0);
    if (sort === "status") return left.status.localeCompare(right.status);
    return left.name.localeCompare(right.name, undefined, {sensitivity: "base"});
  });
}

function matchesSearch(document: StudioDocument, term: string) {
  const normalizedTerm = term.trim().toLowerCase();

  if (!normalizedTerm) return true;

  return [
    document.name,
    document.sourceName,
    document.kind,
    document.status,
    document.amount,
    document.toolLabel
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .includes(normalizedTerm);
}

function formatMetricBytes(bytes: number) {
  if (bytes <= 0) return "0 MB";

  const units = ["B", "KB", "MB", "GB"] as const;
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value >= 10 ? value.toFixed(1) : value.toFixed(2)} ${units[unitIndex]}`;
}

function kpisFor(copy: ReturnType<typeof getStudioCopy>, documents: StudioDocument[], approvals: typeof approvalCopy.en, inbox: typeof inboxCopy.en, inboxCount: number | null, signedIn: boolean) {
  const storage = documents.reduce((total, document) => total + (document.resultSize ?? document.inputSize ?? 0), 0);

  return [
    {
      key: "inbox",
      label: copy.kpis.inbox[0],
      value: inboxCount === null ? "—" : String(inboxCount),
      detail: signedIn ? inboxCount === null ? inbox.unavailable : inbox.pending : inbox.signIn,
      isComingSoon: false
    },
    {
      key: "approvals",
      label: copy.kpis.approvals[0],
      value: approvals.open,
      detail: approvals.subtitle,
      isComingSoon: false
    },
    {
      key: "automation",
      label: copy.kpis.automation[0],
      value: approvals.open,
      detail: copy.nav.workflows,
      isComingSoon: false
    },
    {
      key: "storage",
      label: copy.kpis.storage[0],
      value: formatMetricBytes(storage),
      detail: copy.metrics.temporaryStorage,
      isComingSoon: false
    }
  ] as const;
}

function ModuleView({
  copy,
  documents,
  locale,
  view
}: {
  copy: ReturnType<typeof getStudioCopy>;
  documents: StudioDocument[];
  locale: string;
  view: Exclude<StudioViewKey, "documents">;
}) {
  const module = copy.views[view];
  const attentionDocuments = documents.filter((document) => (
    view === "approvals"
      ? document.status === "review" || document.status === "queued" || document.status === "processing"
      : document.status === "queued" || document.status === "processing"
  ));

  return (
    <section className="studio-module" aria-labelledby="studio-module-title">
      <div className="studio-module-hero">
        <div>
          <span>{copy.header.eyebrow}</span>
          <h2 id="studio-module-title">{module.title}</h2>
          <p>{module.subtitle}</p>
        </div>
        <strong>{module.state}</strong>
      </div>

      <div className="studio-module-grid">
        <article className="studio-module-card">
          <i className="ti ti-files" aria-hidden="true" />
          <div>
            <h3>{copy.nav.documents}</h3>
            <p>{documents.length} {copy.metrics.recentJobs}</p>
            <Link href={`/${locale}/studio`}>{copy.nav.documents}</Link>
          </div>
        </article>

        <article className="studio-module-card">
          <i className="ti ti-clock-hour-4" aria-hidden="true" />
          <div>
            <h3>{copy.statuses.processing}</h3>
            <p>{attentionDocuments.length} {copy.metrics.pending}</p>
            {attentionDocuments.length > 0 ? (
              <ul>
                {attentionDocuments.slice(0, 3).map((document) => (
                  <li key={document.id} title={document.name}>{document.name}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </article>

        <article className="studio-module-card">
          <i className="ti ti-road" aria-hidden="true" />
          <div>
            <h3>{copy.views.workflows.title}</h3>
            <p>{copy.views.workflows.state}</p>
            <Link href={`/${locale}/studio/workflows`}>{copy.views.workflows.title}</Link>
          </div>
        </article>
      </div>
    </section>
  );
}

export function StudioDashboard({initialDocuments, locale, view = "documents"}: StudioDashboardProps) {
  const account = useStudioAccount();
  const authCopy = getAuthCopy(locale);
  const copy = getStudioCopy(locale);
  const approvals = approvalCopy[locale] ?? approvalCopy.en;
  const workflows = workflowCopy[locale] ?? workflowCopy.en;
  const inbox = inboxCopy[locale] ?? inboxCopy.en;
  const inboxMetric = useInboxCount(account.user?.id);
  const catalog = useTranslations("catalog");
  const home = useTranslations("home");
  const activeView = view;
  const [liveDocuments, setLiveDocuments] = useState<StudioDocument[]>(initialDocuments ?? []);
  const [documentLoadState, setDocumentLoadState] = useState<"loading" | "ready" | "error">(
    initialDocuments === null ? "loading" : "ready"
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [savingDocumentId, setSavingDocumentId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [actionFilter, setActionFilter] = useState<ActionFilter>("all");
  const [sort, setSort] = useState<SortOption>("name");
  const [launcherCategory, setLauncherCategory] = useState<StudioToolCategory | null>(null);
  const [isStudioImportOpen, setIsStudioImportOpen] = useState(false);
  const loadControllerRef = useRef<AbortController | null>(null);
  const savePendingRef = useRef(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    let ignore = false;
    loadControllerRef.current?.abort();
    const controller = new AbortController();
    loadControllerRef.current = controller;

    if (initialDocuments !== null) {
      setLiveDocuments(initialDocuments);
      setDocumentLoadState("ready");
      return () => {
        ignore = true;
        loadControllerRef.current?.abort();
      };
    }

    async function loadDocuments() {
      try {
        const documents = await fetchStudioDocuments(locale, controller.signal);

        if (!ignore) {
          setLiveDocuments(documents);
          setDocumentLoadState("ready");
        }
      } catch {
        if (!ignore) setDocumentLoadState("error");
      }
    }

    void loadDocuments();

    return () => {
      ignore = true;
      loadControllerRef.current?.abort();
    };
  }, [initialDocuments, locale]);

  async function reloadDocuments() {
    loadControllerRef.current?.abort();
    const controller = new AbortController();
    loadControllerRef.current = controller;
    try {
      setDocumentLoadState("loading");
      const documents = await fetchStudioDocuments(locale, controller.signal);
      if (controller.signal.aborted) return;
      setLiveDocuments(documents);
      setDocumentLoadState("ready");
    } catch {
      if (!controller.signal.aborted) setDocumentLoadState("error");
    }
  }

  async function saveDocumentToWorkspace(document: StudioDocument) {
    if (!document.isGuest || document.status !== "completed" || savePendingRef.current) return;
    savePendingRef.current = true;

    try {
      setSavingDocumentId(document.id);
      setSaveError("");
      if (!(await account.requestSignIn())) return;

      const response = await fetch("/api/studio/documents", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({jobId: document.id})
      });

      if (!response.ok) throw new Error(authCopy.error);
      const saved = await response.json() as {id: string};
      setSelectedId(saved.id);
      await reloadDocuments();
    } catch {
      setSaveError(authCopy.error);
    } finally {
      savePendingRef.current = false;
      setSavingDocumentId(null);
    }
  }

  const baseDocuments = liveDocuments;
  const documents = useMemo(
    () => sortDocuments(
      baseDocuments.filter((document) => (
        matchesSearch(document, searchTerm) &&
        matchesStatusFilter(document, statusFilter) &&
        (actionFilter === "all" || document.kind === actionFilter)
      )),
      sort
    ),
    [actionFilter, baseDocuments, searchTerm, sort, statusFilter]
  );
  const selectedDocument = useMemo(
    () => documents.find((document) => document.id === selectedId) ?? documents[0] ?? null,
    [documents, selectedId]
  );
  const actionLabelFor = (document: StudioDocument) => (
    document.toolLabel ? catalog(`tools.${document.toolLabel}`) : copy.kinds[document.kind]
  );
  const selectedAction = selectedDocument ? actionLabelFor(selectedDocument) : "";
  const selectedFields = selectedDocument ? selectedFieldsFor(copy, selectedDocument, selectedAction) : [];
  const kpis = kpisFor(copy, baseDocuments, approvals, inbox, inboxMetric.count, Boolean(account.user));
  const viewCopy = activeView === "inbox" ? {...copy.views.inbox, title: inbox.title, subtitle: inbox.subtitle} : activeView === "approvals" ? {...copy.views.approvals, title: approvals.title, subtitle: approvals.subtitle} : activeView === "workflows" ? {...copy.views.workflows,title:workflows.title,subtitle:workflows.subtitle} : copy.views[activeView];
  const launcherItems = launcherCategory ? studioToolItems.filter((item) => item.category === launcherCategory) : [];
  const studioImportItem = studioToolItems.find((item) => item.tool === "reorder_pdf");
  const uploadErrorLabels: ErrorLabels = {
    error: home("upload.error"),
    errorTooLarge: home("upload.errorTooLarge"),
    errorUnsupportedType: home("upload.errorUnsupportedType"),
    errorInvalidFile: home("upload.errorInvalidFile"),
    errorQpdfMissing: home("upload.errorQpdfMissing"),
    errorHeicDecoderMissing: home("upload.errorHeicDecoderMissing"),
    errorLibreOfficeMissing: home("upload.errorLibreOfficeMissing"),
    errorPdfTextMissing: home("upload.errorPdfTextMissing")
  };

  return (
    <div className="studio-shell has-tool-rail">
      <aside className="studio-editor-rail studio-dashboard-rail" aria-label="Studio navigation" onMouseLeave={() => setLauncherCategory(null)}>
        <Link className="studio-editor-logo" href={`/${locale}`} aria-label="Foliant">
          <i className="ti ti-arrow-back-up" aria-hidden="true" />
        </Link>
        <nav>
          {studioToolCategories.map((category) => (
            <div className="studio-editor-tool-item" key={category.id} onMouseEnter={() => setLauncherCategory(category.id)}>
              <button
                className={launcherCategory === category.id ? "active" : ""}
                type="button"
                onClick={() => setLauncherCategory(category.id)}
                onFocus={() => setLauncherCategory(category.id)}
              >
                <i className={`ti ${category.icon}`} aria-hidden="true" />
                <span>{copy.workspace.toolNav[category.label]}</span>
              </button>
              {launcherCategory === category.id ? (
                <section className="studio-tool-flyout" aria-label={copy.workspace.toolNav[category.label]}>
                  {launcherItems.map((item) => {
                    const unavailable = item.mode === "comingSoon" || item.mode === "premium";
                    const availability = item.mode === "premium" ? copy.workspace.launcher.premiumLater : unavailable ? copy.workspace.launcher.comingSoon : copy.workspace.launcher.openDocument;
                    return <button className={unavailable ? "is-unavailable" : ""} disabled key={`${item.tool}-${item.labelKey}`} title={availability} type="button">
                      <i className={`ti ${item.icon}`} aria-hidden="true" />
                      <span>{catalog(`tools.${item.labelKey}`)}<small>{availability}</small></span>
                    </button>;
                  })}
                </section>
              ) : null}
            </div>
          ))}
        </nav>
        <Link className="studio-editor-account" href={`/${locale}/studio`}>
          <i className="ti ti-folder" aria-hidden="true" />
          <span>{copy.workspace.toolNav.documents}</span>
        </Link>
      </aside>

      <main className={`studio-main${activeView === "inbox" || activeView === "approvals" || activeView === "workflows" ? " is-approvals" : ""}`}>
        <header className="studio-header">
          <div>
            <span>{copy.header.eyebrow}</span>
            <h1>{viewCopy.title}</h1>
            <p>{viewCopy.subtitle}</p>
          </div>

          <div className="studio-header-actions">
            <StudioAccountButton locale={locale} />
            {activeView === "documents" ? <label className="studio-search">
              <i className="ti ti-search" aria-hidden="true" />
              <input
                type="search"
                aria-label={copy.header.search}
                placeholder={copy.header.search}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </label> : null}
            <button className="studio-button primary" type="button" onClick={() => setIsStudioImportOpen(true)}>
              <i className="ti ti-upload" aria-hidden="true" />
              <span>{copy.header.upload}</span>
            </button>
          </div>
        </header>

        <nav className="studio-workspace-links" aria-label={copy.header.eyebrow}>
          <Link href={`/${locale}/studio`} aria-current={activeView === "documents" ? "page" : undefined}><i className="ti ti-files" aria-hidden="true" />{copy.nav.documents}</Link>
          <Link href={`/${locale}/studio/inbox`} aria-current={activeView === "inbox" ? "page" : undefined}><i className="ti ti-inbox" aria-hidden="true" />{inbox.title}{inboxMetric.count !== null ? <span className="studio-inbox-count">{inboxMetric.count}</span> : null}</Link>
          <Link href={`/${locale}/studio/approvals`} aria-current={activeView === "approvals" ? "page" : undefined}><i className="ti ti-checkup-list" aria-hidden="true" />{approvals.title}</Link>
          <Link href={`/${locale}/studio/workflows`} aria-current={activeView === "workflows" ? "page" : undefined}><i className="ti ti-route" aria-hidden="true" />{workflows.title}</Link>
        </nav>

        {activeView === "inbox" ? <StudioInbox locale={locale} onChanged={inboxMetric.refresh} /> : activeView === "approvals" ? <StudioApprovals locale={locale} /> : activeView === "workflows" ? <StudioWorkflows locale={locale} /> : activeView !== "documents" ? (
          <ModuleView copy={copy} documents={baseDocuments} locale={locale} view={activeView} />
        ) : (
          <>

        <section className="studio-kpis" aria-label="Studio metrics">
          {kpis.map((item) => (
            <article className="studio-kpi" data-coming-soon={item.isComingSoon || undefined} key={item.key}>
              <span>{item.label}</span>
              {item.key === "inbox" || item.key === "approvals" || item.key === "automation" ? <Link href={`/${locale}/studio/${item.key === "automation" ? "workflows" : item.key}`}>{item.value}<i className="ti ti-arrow-up-right" aria-hidden="true" /></Link> : <strong className={item.isComingSoon ? "studio-kpi-coming-soon" : undefined}>{item.value}</strong>}
              <p>{item.detail}</p>
            </article>
          ))}
        </section>


        <div className="studio-workspace">
          <section className="studio-panel studio-documents" aria-labelledby="studio-recent-title">
            <div className="studio-panel-head">
              <div>
                <h2 id="studio-recent-title">{copy.sections.recent}</h2>
                <p>{copy.sections.recentText}</p>
              </div>
              <div className="studio-panel-tools">
                <button
                  type="button"
                  aria-label={copy.filters.next}
                  title={`${copy.filters.next}: ${copy.filters[statusFilter]}`}
                  onClick={() => setStatusFilter(nextStatusFilter(statusFilter))}
                >
                  <i className="ti ti-filter" aria-hidden="true" />
                  <span className="studio-filter-label">{copy.filters[statusFilter]}</span>
                </button>
                <select aria-label={copy.filters.byAction} title={copy.filters.byAction} value={actionFilter} onChange={(event) => setActionFilter(event.target.value as ActionFilter)}>
                  {actionFilters.map((filter) => <option key={filter} value={filter}>{filter === "all" ? copy.filters.all : copy.kinds[filter]}</option>)}
                </select>
                <select aria-label={copy.filters.sort} title={copy.filters.sort} value={sort} onChange={(event) => setSort(event.target.value as SortOption)}>
                  <option value="name">{copy.filters.sortName}</option>
                  <option value="size">{copy.filters.sortSize}</option>
                  <option value="status">{copy.filters.sortStatus}</option>
                </select>
              </div>
            </div>

            <div className="studio-table" role="table">
              <div className="studio-table-row studio-table-head" role="row">
                <span role="columnheader">{copy.table.document}</span>
                <span role="columnheader">{copy.table.type}</span>
                <span role="columnheader">{copy.table.owner}</span>
                <span role="columnheader">{copy.table.value}</span>
                <span role="columnheader">{copy.table.status}</span>
              </div>
              {documents.length === 0 && documentLoadState === "loading" ? (
                <div className="studio-empty-row">
                  <i className="ti ti-loader-2" aria-hidden="true" />
                  <strong>{copy.empty.loading}</strong>
                </div>
              ) : documents.length === 0 && documentLoadState === "error" ? (
                <div className="studio-empty-row">
                  <i className="ti ti-cloud-off" aria-hidden="true" />
                  <strong>{copy.empty.loadError}</strong>
                  <button className="studio-button primary" type="button" onClick={() => void reloadDocuments()}>
                    <i className="ti ti-refresh" aria-hidden="true" />
                    <span>{copy.empty.retry}</span>
                  </button>
                </div>
              ) : documents.length === 0 ? (
                <div className="studio-empty-row">
                  <i className="ti ti-file-upload" aria-hidden="true" />
                  <strong>{copy.empty.title}</strong>
                  <span>{copy.empty.text}</span>
                  <button className="studio-button primary" type="button" onClick={() => setIsStudioImportOpen(true)}>
                    <i className="ti ti-upload" aria-hidden="true" />
                    <span>{copy.header.upload}</span>
                  </button>
                </div>
              ) : documents.map((document) => (
                <Link
                  className="studio-table-row"
                  data-active={document.id === selectedDocument?.id}
                  role="row"
                  key={document.id}
                  href={`/${locale}/studio/documents/${document.id}`}
                  onFocus={() => setSelectedId(document.id)}
                >
                  <span className="studio-document-name" role="cell" title={document.name}>
                    <i className={`ti ${iconFor(document)}`} aria-hidden="true" />
                    <span>{document.name}</span>
                  </span>
                  <span role="cell" title={copy.kinds[document.kind]}>{copy.kinds[document.kind]}</span>
                  <span role="cell" title={copy.owners[document.owner]}>{copy.owners[document.owner]}</span>
                  <span role="cell" title={document.amount || `${document.pages}p`}>{document.amount || `${document.pages}p`}</span>
                  <span className="studio-status" data-tone={document.tone} role="cell" title={copy.statuses[document.status]}>{copy.statuses[document.status]}</span>
                </Link>
              ))}
            </div>
          </section>

          <aside className="studio-panel studio-detail" aria-labelledby="studio-selected-title">
            {selectedDocument ? (
              <>
                <div className="studio-panel-head compact">
                  <h2 id="studio-selected-title">{copy.sections.selected}</h2>
                  <span className="studio-status" data-tone={selectedDocument.tone}>{copy.statuses[selectedDocument.status]}</span>
                </div>

                <div className="studio-preview" aria-label={copy.sections.preview}>
                  <div className="studio-preview-toolbar">
                    <span>{copy.sections.preview}</span>
                    <i className="ti ti-dots" aria-hidden="true" />
                  </div>
                  {selectedDocument.previewUrl ? (
                    <iframe
                      className="studio-pdf-preview"
                      src={selectedDocument.previewUrl}
                      title={`${copy.sections.preview} - ${selectedDocument.name}`}
                    />
                  ) : selectedDocument.isLive ? (
                    <div className="studio-file-preview">
                      <i className={`ti ${iconFor(selectedDocument)}`} aria-hidden="true" />
                      <strong title={selectedDocument.name}>{selectedDocument.name}</strong>
                      <span title={selectedAction}>{selectedAction}</span>
                    </div>
                  ) : (
                    <div className="studio-paper-preview">
                      <span />
                      <span />
                      <span className="short" />
                      <div className="studio-stamp">{copy.statuses[selectedDocument.status]}</div>
                      <span />
                      <span className="mid" />
                    </div>
                  )}
                </div>

                <div className="studio-fields">
                  <h3>{copy.sections.extracted}</h3>
                  <dl>
                    {selectedFields.map((field) => (
                      <div key={field.label}>
                        <dt>{field.label}</dt>
                        <dd title={field.value}>{field.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>

                <div className="studio-decision">
                  {selectedDocument.isLive ? (
                    <>
                      {selectedDocument.resultUrl ? (
                        <a className="studio-button primary" href={selectedDocument.resultUrl}>
                          <i className="ti ti-download" aria-hidden="true" />
                          <span>{copy.selected.download}</span>
                        </a>
                      ) : (
                        <button className="studio-button primary" type="button" disabled>
                          <i className="ti ti-loader-2" aria-hidden="true" />
                          <span>{copy.selected.inProgress}</span>
                        </button>
                      )}
                      <button
                        className="studio-button secondary"
                        type="button"
                        disabled={!selectedDocument.isGuest || selectedDocument.status !== "completed" || savingDocumentId !== null}
                        onClick={() => void saveDocumentToWorkspace(selectedDocument)}
                      >
                        <i className={`ti ${savingDocumentId === selectedDocument.id ? "ti-loader-2" : "ti-folder-plus"}`} aria-hidden="true" />
                        <span>{copy.selected.save}</span>
                      </button>
                    </>
                  ) : (
                    <>
                      <button className="studio-button primary" type="button" disabled>
                        <i className="ti ti-check" aria-hidden="true" />
                        <span>{copy.selected.approve}</span>
                      </button>
                      <button className="studio-button secondary" type="button" disabled>
                        <i className="ti ti-send" aria-hidden="true" />
                        <span>{copy.selected.send}</span>
                      </button>
                    </>
                  )}
                </div>
                {saveError ? <p className="studio-guest-error" role="alert">{saveError}</p> : null}
              </>
              ) : (
                <div className="studio-empty-detail">
                  <i className="ti ti-file-search" aria-hidden="true" />
                  <strong>{copy.empty.title}</strong>
                  <span>{copy.empty.selected}</span>
                </div>
              )}
          </aside>
        </div>

        <div className="studio-bottom-grid">

          <StudioActivity key={account.user?.id ?? "guest"} locale={locale} signedIn={Boolean(account.user)} />
        </div>
          </>
        )}
      </main>
      {isStudioImportOpen && studioImportItem ? (
        <StudioToolUploadDialog
          errorLabels={uploadErrorLabels}
          item={studioImportItem}
          labels={copy.workspace.launcher}
          locale={locale}
          onClose={() => setIsStudioImportOpen(false)}
          toolName={copy.header.upload}
        />
      ) : null}
    </div>
  );
}
