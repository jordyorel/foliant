"use client";

import Link from "next/link";
import {useEffect, useState} from "react";
import {approvalCopy} from "@/content/approvals";
import {useStudioAccount} from "./StudioAccount";
import type {StudioApproval} from "@/lib/studio/approval-types";

export function StudioApprovals({locale, documentId, refreshToken = 0}: {locale: string; documentId?: string; refreshToken?: number}) {
  const account = useStudioAccount();
  const copy = approvalCopy[locale] ?? approvalCopy.en;
  if (!account.user) return <p className="studio-approval-state">{copy.signIn}</p>;
  return <ApprovalList key={`${account.user.id}:${documentId ?? "all"}`} locale={locale} documentId={documentId} refreshToken={refreshToken} />;
}

function ApprovalList({locale, documentId, refreshToken}: {locale: string; documentId?: string; refreshToken: number}) {
  const copy = approvalCopy[locale] ?? approvalCopy.en;
  const [records, setRecords] = useState<StudioApproval[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [refresh, setRefresh] = useState(0);
  const [direction, setDirection] = useState<"all" | "received" | "sent">("all");
  const [status, setStatus] = useState("all");
  useEffect(() => {
    const controller = new AbortController();
    setState("loading");
    void fetch(`/api/studio/approvals${documentId ? `?documentId=${encodeURIComponent(documentId)}` : ""}`, {cache: "no-store", signal: controller.signal})
      .then(async response => {
        if (!response.ok) throw new Error("Approvals unavailable");
        const body = await response.json() as {approvals: StudioApproval[]};
        if (!controller.signal.aborted) {setRecords(body.approvals); setState("ready");}
      }).catch(() => {if (!controller.signal.aborted) setState("error");});
    return () => controller.abort();
  }, [documentId, refresh, refreshToken]);
  useEffect(() => {
    const update = () => setRefresh(value => value + 1);
    window.addEventListener("focus", update);
    return () => window.removeEventListener("focus", update);
  }, []);
  const visible = records.filter(record => (direction === "all" || record.role === (direction === "sent" ? "owner" : "reviewer")) && (status === "all" || record.status === status));
  const date = (value: string) => new Intl.DateTimeFormat(locale, {dateStyle: "medium", timeStyle: "short"}).format(new Date(value));
  return <section className="studio-approvals" aria-label={copy.title}>
    <header className="studio-approval-list-head">
      <div className="studio-approval-tabs" role="group" aria-label={copy.title}>
        {(["all", "received", "sent"] as const).map(value => <button key={value} type="button" aria-pressed={direction === value} onClick={() => setDirection(value)}>{copy[value]}</button>)}
      </div>
      <select aria-label={copy.pending} value={status} onChange={event => setStatus(event.currentTarget.value)}>
        {(["all", "pending", "approved", "rejected", "canceled"] as const).map(value => <option key={value} value={value}>{copy[value]}</option>)}
      </select>
      <button className="studio-approval-icon" type="button" aria-label={copy.refresh} title={copy.refresh} onClick={() => setRefresh(value => value + 1)}><i className="ti ti-refresh" aria-hidden="true" /></button>
    </header>
    {state === "loading" ? <p role="status">{copy.loading}</p> : state === "error" ? <p role="alert">{copy.unavailable}</p> : visible.length === 0 ? <p>{copy.empty}</p> : <ol className="studio-approval-list">
      {visible.map(record => <li key={record.id}>
        <i className="ti ti-checkup-list" aria-hidden="true" />
        <div><Link href={`/${locale}/studio/approvals/${record.id}`}>{record.documentName}</Link>
          <small>{copy.version} {record.versionNumber} · {record.role === "owner" ? copy.to : copy.requester} {record.role === "owner" ? record.reviewerEmail : record.ownerEmail}</small>
          <time dateTime={record.createdAt}>{date(record.createdAt)}</time>
          {record.decidedAt ? <small>{copy.decision} · {date(record.decidedAt)}</small> : null}
        </div>
        <span className="studio-approval-badge" data-status={record.status}>{copy[record.status]}</span>
        <Link className="studio-approval-icon" href={`/${locale}/studio/approvals/${record.id}`} aria-label={copy.open} title={copy.open}><i className="ti ti-arrow-up-right" aria-hidden="true" /></Link>
      </li>)}
    </ol>}
    {records.length === 100 ? <small>{copy.limited}</small> : null}
  </section>;
}

export function StudioApprovalRequest({locale, documentId, initialVersionId, onBusyChange}: {locale: string; documentId: string; initialVersionId?: string | null; onBusyChange?: (busy: boolean) => void}) {
  const copy = approvalCopy[locale] ?? approvalCopy.en;
  const [versions, setVersions] = useState<{id: string; versionNumber: number}[]>([]);
  const [versionId, setVersionId] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [consent, setConsent] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sentId, setSentId] = useState("");
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/studio/documents/${encodeURIComponent(documentId)}/versions`, {cache: "no-store", signal: controller.signal}).then(async response => {
      if (!response.ok) throw new Error("Versions unavailable");
      const body = await response.json() as {versions: {id: string; versionNumber: number}[]};
      const saved = body.versions.filter(version => !version.id.startsWith("legacy_"));
      if (!controller.signal.aborted) {
        setVersions(saved);
        setVersionId(saved.some(version => version.id === initialVersionId) ? initialVersionId! : saved.reduce((latest, item) => item.versionNumber > (latest?.versionNumber ?? 0) ? item : latest, saved[0])?.id ?? "");
        setState("ready");
      }
    }).catch(() => {if (!controller.signal.aborted) setState("error");});
    return () => controller.abort();
  }, [documentId, initialVersionId]);
  async function send() {
    setBusy(true); onBusyChange?.(true); setError(""); setSentId("");
    try {
      const response = await fetch("/api/studio/approvals", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({documentId, versionId, recipientEmail: email, note})});
      const body = await response.json() as {code?: string; approval?: StudioApproval};
      if (!response.ok || !body.approval) throw new Error(body.code ?? "unavailable");
      setSentId(body.approval.id); setRefresh(value => value + 1); setConsent(false);
    } catch (failure) {
      const key = failure instanceof Error ? failure.message : "unavailable";
      setError(copy.errors[key as keyof typeof copy.errors] ?? copy.errors.unavailable);
    } finally {setBusy(false); onBusyChange?.(false);}
  }
  return <div className="studio-approval-request">
    <h2>{copy.request}</h2>
    {state === "loading" ? <p role="status">{copy.loading}</p> : state === "error" ? <p role="alert">{copy.unavailable}</p> : <form onSubmit={event => {event.preventDefault(); if (consent && versionId && !busy) void send();}}>
      <label>{copy.version}<select value={versionId} disabled={busy || !versions.length} onChange={event => {setVersionId(event.currentTarget.value); setConsent(false); setSentId("");}}>
        {!versions.length ? <option value="">—</option> : versions.map(version => <option key={version.id} value={version.id}>{copy.version} {version.versionNumber}</option>)}
      </select></label>
      <label>{copy.recipient}<input type="email" required maxLength={254} autoComplete="email" value={email} disabled={busy} onChange={event => {setEmail(event.currentTarget.value); setConsent(false); setSentId("");}} /></label>
      <label>{copy.note}<textarea maxLength={2000} rows={3} value={note} disabled={busy} onChange={event => setNote(event.currentTarget.value)} /></label>
      <label className="studio-approval-consent"><input type="checkbox" checked={consent} disabled={busy || !versions.length} onChange={event => setConsent(event.currentTarget.checked)} /><span>{copy.consent}</span></label>
      <small>{copy.existingAccount}</small>
      {error ? <p role="alert">{error}</p> : null}
      {sentId ? <Link className="studio-approval-success" href={`/${locale}/studio/approvals/${sentId}`}><i className="ti ti-check" aria-hidden="true" />{copy.open}</Link> : null}
      <button className="studio-button primary" type="submit" disabled={!versionId || !consent || busy}><i className={`ti ${busy ? "ti-loader-2" : "ti-send"}`} aria-hidden="true" />{busy ? copy.saving : copy.send}</button>
    </form>}
    <h3>{copy.title}</h3>
    <StudioApprovals locale={locale} documentId={documentId} refreshToken={refresh} />
  </div>;
}
