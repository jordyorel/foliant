"use client";

import Link from "next/link";
import {useEffect, useRef, useState} from "react";
import {useRouter} from "next/navigation";
import {inboxCopy} from "@/content/inbox";
import type {InboxDetail, InboxList, InboxReceipt, InboxStatus} from "@/lib/studio/inbox-types";
import {fetchInboxList, inboxRequest, inboxErrorKey, InboxClientError, receiveInboxFile} from "@/lib/studio/inbox-client";
import {useStudioAccount} from "./StudioAccount";

type Copy = typeof inboxCopy.en;
const pageSize = 50;
const errorText = (copy: Copy, error: unknown) => copy[inboxErrorKey(error) as keyof Copy];
const formatDate = (locale: string, value: string) => new Intl.DateTimeFormat(locale, {dateStyle: "medium", timeStyle: "short"}).format(new Date(value));
const formatBytes = (locale: string, value: number) => {
  const divisor = value >= 1024 * 1024 ? 1024 * 1024 : value >= 1024 ? 1024 : 1;
  return `${new Intl.NumberFormat(locale, {maximumFractionDigits: 1}).format(value / divisor)} ${divisor === 1 ? "B" : divisor === 1024 ? "KB" : "MB"}`;
};

export function useInboxCount(userId?: string) {
  const [result, setResult] = useState<{userId: string; total: number | null} | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    if (!userId) return;
    const controller = new AbortController();
    setResult(null);
    void fetchInboxList("received", 0, "", "newest", controller.signal)
      .then(body => {if (!controller.signal.aborted) setResult({userId, total: body.total});})
      .catch(() => {if (!controller.signal.aborted) setResult({userId, total: null});});
    return () => controller.abort();
  }, [userId, refresh]);
  useEffect(() => {
    const update = () => setRefresh(value => value + 1);
    window.addEventListener("focus", update);
    return () => window.removeEventListener("focus", update);
  }, []);
  return {count: userId && result?.userId === userId ? result.total : null, refresh: () => setRefresh(value => value + 1)};
}

export function StudioInbox({locale, onChanged}: {locale: string; onChanged: () => void}) {
  const account = useStudioAccount();
  const copy = inboxCopy[locale] ?? inboxCopy.en;
  if (!account.user) return <div className="studio-inbox-state"><p>{copy.signIn}</p><button className="studio-button primary" type="button" onClick={() => void account.requestSignIn()}>{copy.signIn}</button></div>;
  return <InboxWorkspace key={account.user.id} locale={locale} onChanged={onChanged} />;
}

function InboxWorkspace({locale, onChanged}: {locale: string; onChanged: () => void}) {
  const copy = inboxCopy[locale] ?? inboxCopy.en;
  const [query, setQuery] = useState({status: "received" as InboxStatus, offset: 0, search: "", sort: "newest"});
  const [search, setSearch] = useState("");
  const [list, setList] = useState<InboxList | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [refresh, setRefresh] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const selectedButton = useRef<HTMLButtonElement | null>(null);
  const searchInput = useRef<HTMLInputElement | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(value => value.search === search.trim() ? value : {...value, search: search.trim(), offset: 0}), 300);
    return () => clearTimeout(timer);
  }, [search]);
  useEffect(() => {
    const controller = new AbortController();
    setState("loading"); setError("");
    void fetchInboxList(query.status, query.offset, query.search, query.sort, controller.signal).then(body => {
      if (controller.signal.aborted) return;
      if (query.offset && query.offset >= body.total) {
        setQuery(value => ({...value, offset: Math.max(0, Math.ceil(body.total / pageSize) - 1) * pageSize}));
        return;
      }
      setList(body); setState("ready");
    }).catch(failure => {if (!controller.signal.aborted) {setError(errorText(copy, failure)); setState("error");}});
    return () => controller.abort();
  }, [query, refresh, copy]);
  useEffect(() => {
    const update = () => setRefresh(value => value + 1);
    window.addEventListener("focus", update);
    return () => window.removeEventListener("focus", update);
  }, []);
  function changed(message: string) {
    setNotice(message); setRefresh(value => value + 1); onChanged();
  }
  const empty = query.search ? copy.noMatch : query.status === "accepted" ? copy.emptyAccepted : query.status === "archived" ? copy.emptyArchived : copy.empty;
  return <section className="studio-inbox" aria-label={copy.title}>
    <InboxDeposit locale={locale} onReceived={receipt => {
      setSearch(""); setQuery({status: "received", offset: 0, search: "", sort: "newest"});
      setSelectedId(receipt.id); changed(copy.receivedSuccess);
    }} />
    <div className="studio-inbox-toolbar">
      <div className="studio-approval-tabs" role="group" aria-label={copy.title}>
        {(["received", "accepted", "archived"] as const).map(status => <button key={status} type="button" aria-pressed={query.status === status} onClick={() => {
          setQuery(value => ({...value, status, offset: 0})); setSelectedId(null); setNotice("");
        }}>{copy[status]}</button>)}
      </div>
      <label className="studio-search"><i className="ti ti-search" aria-hidden="true" /><input ref={searchInput} type="search" maxLength={180} aria-label={copy.search} placeholder={copy.search} value={search} onChange={event => setSearch(event.currentTarget.value)} /></label>
      <select aria-label={copy.sort} value={query.sort} onChange={event => {const sort = event.currentTarget.value; setQuery(value => ({...value, sort, offset: 0}));}}>
        <option value="newest">{copy.newest}</option><option value="oldest">{copy.oldest}</option>
      </select>
      <button className="studio-approval-icon" type="button" aria-label={copy.refresh} onClick={() => {setRefresh(value => value + 1); onChanged();}}><i className="ti ti-refresh" aria-hidden="true" /></button>
    </div>
    <p className="studio-inbox-notice" role="status">{notice}</p>
    <div className={selectedId ? "studio-inbox-grid has-detail" : "studio-inbox-grid"}>
      <div aria-busy={state === "loading"}>
        {state === "loading" ? <p className="studio-inbox-state" role="status">{copy.loading}</p> : state === "error" ? <div className="studio-inbox-state"><p role="alert">{error}</p><button className="studio-button secondary" onClick={() => setRefresh(value => value + 1)}>{copy.retry}</button></div> : !list?.receipts.length ? <p className="studio-inbox-state">{empty}</p> : <ol className="studio-inbox-list">
          {list.receipts.map(receipt => <li key={receipt.id}>
            <button type="button" aria-pressed={selectedId === receipt.id} onClick={event => {selectedButton.current = event.currentTarget; setSelectedId(receipt.id);}}>
              <i className={`ti ${receipt.isProtected ? "ti-shield-lock" : "ti-file-type-pdf"}`} aria-hidden="true" />
              <span className="studio-inbox-file"><strong>{receipt.name}</strong><small>{formatBytes(locale, receipt.size)} · {copy.manual}</small><time dateTime={receipt.createdAt}>{formatDate(locale, receipt.createdAt)}</time></span>
              <span className="studio-approval-badge" data-status={receipt.status}>{copy[receipt.status]}</span>
            </button>
          </li>)}
        </ol>}
        {state !== "error" && list && list.total > 0 ? <nav className="studio-inbox-pagination" aria-label={copy.pages}>
          <button className="studio-button secondary" disabled={state === "loading" || !query.offset} onClick={() => setQuery(value => ({...value, offset: Math.max(0, value.offset - pageSize)}))}>{copy.previous}</button>
          <span>{query.offset + 1}–{Math.min(query.offset + pageSize, list.total)} / {list.total} {copy.total}</span>
          <button className="studio-button secondary" disabled={state === "loading" || query.offset + pageSize >= list.total} onClick={() => setQuery(value => ({...value, offset: value.offset + pageSize}))}>{copy.next}</button>
        </nav> : null}
      </div>
      {selectedId ? <InboxReceiptDetail key={selectedId} id={selectedId} locale={locale} refresh={refresh} onChanged={changed} onClose={() => {
        setSelectedId(null);
        if (selectedButton.current?.isConnected) selectedButton.current.focus();
        else searchInput.current?.focus();
      }} /> : null}
    </div>
  </section>;
}

function InboxDeposit({locale, onReceived}: {locale: string; onReceived: (receipt: InboxReceipt) => void}) {
  const copy = inboxCopy[locale] ?? inboxCopy.en;
  const [selection, setSelection] = useState<{file: File; key: string} | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);
  const pending = useRef(false);
  const controller = useRef<AbortController | null>(null);
  const input = useRef<HTMLInputElement | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  function choose(file?: File) {
    if (pending.current || !file) return;
    setError(""); setSelection(null);
    if (file.size > 25 * 1024 * 1024) {setError(copy.fileTooLarge); return;}
    if (!file.size) {setError(copy.invalidPdf); return;}
    if (!/\.pdf$/i.test(file.name)) {setError(copy.invalidPdf); return;}
    if (file.name.length > 180 || /[\x00-\x1f\x7f/\\]/.test(file.name)) {setError(copy.invalidName); return;}
    setSelection({file, key: crypto.randomUUID()});
  }
  async function receive() {
    if (!selection || pending.current) return;
    pending.current = true; setBusy(true); setError("");
    const abort = new AbortController(); controller.current = abort;
    try {
      const receipt = await receiveInboxFile(selection.file, selection.key, abort.signal);
      if (!abort.signal.aborted) {setSelection(null); if (input.current) input.current.value = ""; onReceived(receipt);}
    } catch (failure) {if (!abort.signal.aborted) setError(errorText(copy, failure));}
    finally {pending.current = false; if (!abort.signal.aborted) setBusy(false);}
  }
  return <form className="studio-inbox-deposit" data-dragging={dragging || undefined} onSubmit={event => {event.preventDefault(); void receive();}}
    onDragOver={event => {event.preventDefault(); if (!busy) setDragging(true);}}
    onDragLeave={event => {if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setDragging(false);}}
    onDrop={event => {event.preventDefault(); setDragging(false); if (event.dataTransfer.files.length !== 1) {setError(copy.select); return;} choose(event.dataTransfer.files[0]);}}>
    <div><h2>{copy.deposit}</h2><p>{copy.drop} · {copy.limit}</p></div>
    <label className="studio-button secondary studio-inbox-choose">{copy.choose}<input ref={input} aria-label={copy.choose} type="file" accept=".pdf,application/pdf" disabled={busy} onChange={event => choose(event.currentTarget.files?.[0])} /></label>
    {selection ? <span className="studio-inbox-selection">{selection.file.name} · {formatBytes(locale, selection.file.size)}</span> : null}
    <button className="studio-button primary" type="submit" disabled={!selection || busy}>{busy ? copy.uploading : copy.upload}</button>
    {error ? <p className="studio-guest-error" role="alert">{error}</p> : null}
  </form>;
}

function InboxReceiptDetail({id, locale, refresh, onChanged, onClose}: {
  id: string; locale: string; refresh: number; onChanged: (message: string) => void; onClose: () => void;
}) {
  const copy = inboxCopy[locale] ?? inboxCopy.en;
  const router = useRouter();
  const [detail, setDetail] = useState<InboxDetail | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const title = useRef<HTMLHeadingElement | null>(null);
  const mutation = useRef<AbortController | null>(null);
  const pending = useRef(false);
  useEffect(() => {title.current?.focus(); return () => mutation.current?.abort();}, []);
  useEffect(() => {
    const abort = new AbortController();
    setState("loading"); setError(""); setDetail(null);
    void inboxRequest<InboxDetail>(`/api/studio/inbox/${id}`, {signal: abort.signal}).then(body => {
      if (!abort.signal.aborted) {setDetail(body); setState("ready");}
    }).catch(failure => {if (!abort.signal.aborted) {setError(errorText(copy, failure)); setState("error");}});
    return () => abort.abort();
  }, [id, refresh, retry, copy]);
  async function act(action: "accept" | "archive" | "restore") {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError("");
    const abort = new AbortController(); mutation.current = abort;
    try {
      const receipt = await inboxRequest<InboxReceipt>(`/api/studio/inbox/${id}${action === "accept" ? "/accept" : ""}`, {
        signal: abort.signal, method: action === "accept" ? "POST" : "PATCH",
        ...(action !== "accept" ? {headers: {"Content-Type": "application/json"}, body: JSON.stringify({archive: action === "archive"})} : {})
      });
      if (abort.signal.aborted) return;
      onChanged(action === "archive" ? copy.archivedSuccess : action === "restore" ? copy.restoredSuccess : copy.accepted);
      if (action === "accept" && receipt.documentId) router.push(`/${locale}/studio/documents/${receipt.documentId}`);
    } catch (failure) {if (!abort.signal.aborted) setError(errorText(copy, failure));}
    finally {pending.current = false; if (!abort.signal.aborted) setBusy(false);}
  }
  return <aside className="studio-inbox-detail" aria-labelledby="inbox-detail-title">
    <header><h2 ref={title} tabIndex={-1} id="inbox-detail-title">{copy.detail}</h2><button className="studio-approval-icon" type="button" disabled={busy} aria-label={copy.close} onClick={onClose}><i className="ti ti-x" aria-hidden="true" /></button></header>
    {state === "loading" ? <p role="status">{copy.loading}</p> : state === "error" ? <div><p role="alert">{error}</p><button className="studio-button secondary" onClick={() => setRetry(value => value + 1)}>{copy.retry}</button></div> : detail ? <>
      <h3 className="studio-inbox-detail-name">{detail.name}</h3>
      <span className="studio-approval-badge" data-status={detail.status}>{copy[detail.status]}</span>
      <dl className="studio-inbox-metadata">
        <div><dt>{copy.size}</dt><dd>{formatBytes(locale, detail.size)}</dd></div>
        <div><dt>{copy.pages}</dt><dd>{detail.pageCount ?? copy.unknown}</dd></div>
        <div><dt>{copy.date}</dt><dd><time dateTime={detail.createdAt}>{formatDate(locale, detail.createdAt)}</time></dd></div>
        <div><dt>{copy.origin}</dt><dd>{copy.manual}</dd></div>
      </dl>
      {detail.isProtected ? <div className="studio-inbox-state"><strong>{copy.protected}</strong><p>{copy.protectedText}</p></div> : <InboxPreview id={id} name={detail.name} copy={copy} />}
      <div className="studio-inbox-actions">
        <a className="studio-button secondary" href={`/api/studio/inbox/${id}/file`}>{copy.download}</a>
        {detail.status === "received" ? <button className="studio-button primary" disabled={busy} onClick={() => void act("accept")}>{busy ? copy.busy : copy.add}</button> : null}
        {detail.documentId ? <Link className="studio-button secondary" href={`/${locale}/studio/documents/${detail.documentId}`}>{copy.open}</Link> : detail.status === "accepted" ? <p>{copy.deleted}</p> : null}
        <button className="studio-button secondary" disabled={busy} onClick={() => void act(detail.status === "archived" ? "restore" : "archive")}>{busy ? copy.busy : detail.status === "archived" ? copy.restore : copy.archive}</button>
      </div>
      {error ? <p className="studio-guest-error" role="alert">{error}</p> : null}
      <h3>{copy.history}</h3><ol className="studio-inbox-history">{detail.events.map(event => <li key={event.id}><span>{copy[event.action]}</span><time dateTime={event.created_at}>{formatDate(locale, event.created_at)}</time></li>)}</ol>
    </> : null}
  </aside>;
}

function InboxPreview({id, name, copy}: {id: string; name: string; copy: Copy}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    let objectUrl = "";
    setUrl(""); setError("");
    void fetch(`/api/studio/inbox/${id}/file?inline=1`, {cache: "no-store", signal: abort.signal}).then(async response => {
      if (!response.ok) {const body = await response.json().catch(() => null); throw new InboxClientError(body?.code ?? "inbox_unavailable");}
      const blob = await response.blob();
      if (!abort.signal.aborted) {objectUrl = URL.createObjectURL(blob); setUrl(objectUrl);}
    }).catch(failure => {if (!abort.signal.aborted) setError(errorText(copy, failure));});
    return () => {abort.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl);};
  }, [id, retry, copy]);
  return <div className="studio-inbox-preview">{error ? <div><p role="alert">{error}</p><button className="studio-button secondary" onClick={() => setRetry(value => value + 1)}>{copy.retry}</button></div> : url ? <iframe src={url} title={`${copy.preview} — ${name}`} /> : <p role="status">{copy.loading}</p>}</div>;
}
