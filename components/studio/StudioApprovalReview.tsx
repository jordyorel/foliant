"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import {useEffect, useState} from "react";
import {StudioAccountButton, useStudioAccount} from "./StudioAccount";
import {approvalCopy} from "@/content/approvals";
import {getStudioCopy} from "@/content/studio";
import type {ApprovalDecision, StudioApproval} from "@/lib/studio/approval-types";

const StudioPdfViewer = dynamic(() => import("./StudioPdfViewer").then(module => module.StudioPdfViewer), {ssr: false});

export function StudioApprovalReview({locale, approvalId}: {locale: string; approvalId: string}) {
  const account = useStudioAccount();
  const copy = approvalCopy[locale] ?? approvalCopy.en;
  return <main className="studio-approval-review">
    <header><Link href={`/${locale}/studio/approvals`}><i className="ti ti-arrow-left" aria-hidden="true" />{copy.back}</Link><StudioAccountButton locale={locale} /></header>
    {!account.user ? <p>{copy.signIn}</p> : <Review key={`${account.user.id}:${approvalId}`} locale={locale} approvalId={approvalId} />}
  </main>;
}

function Review({locale, approvalId}: {locale: string; approvalId: string}) {
  const copy = approvalCopy[locale] ?? approvalCopy.en;
  const studio = getStudioCopy(locale);
  const [record, setRecord] = useState<StudioApproval | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [comment, setComment] = useState("");
  const [decision, setDecision] = useState<ApprovalDecision | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(`/api/studio/approvals/${encodeURIComponent(approvalId)}`, {cache: "no-store", signal: controller.signal}).then(async response => {
      if (!response.ok) throw new Error("Request unavailable");
      const body = await response.json() as {approval: StudioApproval};
      if (!controller.signal.aborted) {setRecord(body.approval); setState("ready"); setDecision(null);}
    }).catch(() => {if (!controller.signal.aborted) {setRecord(null); setState("error");}});
    return () => controller.abort();
  }, [approvalId, refresh]);
  useEffect(() => {
    const update = () => setRefresh(value => value + 1);
    window.addEventListener("focus", update);
    return () => window.removeEventListener("focus", update);
  }, []);
  async function confirm() {
    if (!decision || busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/studio/approvals/${encodeURIComponent(approvalId)}`, {method: "PATCH", headers: {"Content-Type": "application/json"}, body: JSON.stringify({decision, comment})});
      const body = await response.json() as {code?: string; approval?: StudioApproval};
      if (!response.ok || !body.approval) throw new Error(body.code ?? "unavailable");
      setRecord(body.approval); setDecision(null);
    } catch (failure) {
      const key = failure instanceof Error ? failure.message : "unavailable";
      setError(copy.errors[key as keyof typeof copy.errors] ?? copy.errors.unavailable);
      if (key === "conflict") setRefresh(value => value + 1);
    } finally {setBusy(false);}
  }
  if (state !== "ready" || !record) return <section className="studio-approval-state"><p role={state === "error" ? "alert" : "status"}>{state === "error" ? copy.unavailable : copy.loading}</p><button type="button" onClick={() => setRefresh(value => value + 1)}>{copy.refresh}</button></section>;
  const fileUrl = `/api/studio/approvals/${encodeURIComponent(record.id)}/file`;
  const date = (value: string) => new Intl.DateTimeFormat(locale, {dateStyle: "medium", timeStyle: "short"}).format(new Date(value));
  return <>
    <div className="studio-approval-review-title"><div><h1>{record.documentName}</h1><p>{copy.version} {record.versionNumber}</p></div><span className="studio-approval-badge" data-status={record.status}>{copy[record.status]}</span></div>
    <div className="studio-approval-review-body">
      <section className="studio-approval-preview" aria-label={studio.workspace.preview}>
        {record.status === "canceled" ? <p>{copy.fileUnavailable}</p> : <StudioPdfViewer actionLabel={copy.title} activeTool="hand" fallbackPageCount={1} name={record.documentName} previewUrl={fileUrl}
          labels={{removeAnnotation: studio.workspace.signModal.removeAnnotation, addFile: studio.workspace.addFile, comingSoon: studio.workspace.comingSoon, hideThumbnails: studio.workspace.hideThumbnails, hideResultPanel: studio.workspace.hideResultPanel, loading: studio.selected.inProgress, pageActions: studio.workspace.pageActions, preview: studio.workspace.preview, resultPanel: studio.workspace.resultPanel, showThumbnails: studio.workspace.showThumbnails, showResultPanel: studio.workspace.showResultPanel, thumbnails: studio.workspace.thumbnails, unavailableText: copy.fileUnavailable, unavailableTitle: studio.workspace.unavailableTitle}} />}
      </section>
      <aside className="studio-approval-decision">
        <h2>{copy.title}</h2>
        <dl><dt>{copy.requester}</dt><dd>{record.ownerEmail}</dd><dt>{copy.to}</dt><dd>{record.reviewerEmail}</dd></dl>
        {record.status !== "canceled" ? <a href={fileUrl} target="_blank" rel="noreferrer"><i className="ti ti-file-type-pdf" aria-hidden="true" />{copy.file}</a> : null}
        <ol className="studio-approval-timeline"><li><span>{copy.requested}</span><time dateTime={record.createdAt}>{date(record.createdAt)}</time>{record.note ? <p>{record.note}</p> : null}</li>
          {record.decidedAt ? <li><span>{copy[record.status]}</span><time dateTime={record.decidedAt}>{date(record.decidedAt)}</time>{record.comment ? <p>{record.comment}</p> : null}</li> : null}
        </ol>
        {record.status === "pending" ? <>
          <label>{copy.comment}<textarea rows={4} maxLength={2000} value={comment} disabled={busy} onChange={event => setComment(event.currentTarget.value)} /></label>
          {decision ? <fieldset disabled={busy}><legend>{decision === "canceled" ? copy.confirmCancel : copy.confirmDecision}</legend><p>{copy[decision]} · {copy.version} {record.versionNumber}</p>
            <div className="studio-approval-decision-actions"><button className="studio-button" type="button" onClick={() => setDecision(null)}>{copy.keep}</button><button className="studio-button primary" type="button" onClick={() => void confirm()}>{busy ? copy.saving : copy.confirm}</button></div>
          </fieldset> : <div className="studio-approval-decision-actions">
            {record.role === "owner" ? <button className="studio-button" type="button" onClick={() => setDecision("canceled")}><i className="ti ti-x" aria-hidden="true" />{copy.cancel}</button> : <>
              <button className="studio-button primary" type="button" onClick={() => setDecision("approved")}><i className="ti ti-check" aria-hidden="true" />{copy.approve}</button>
              <button className="studio-button" type="button" onClick={() => setDecision("rejected")}><i className="ti ti-x" aria-hidden="true" />{copy.reject}</button>
            </>}
          </div>}
        </> : null}
        {error ? <p role="alert">{error}</p> : null}
      </aside>
    </div>
  </>;
}
