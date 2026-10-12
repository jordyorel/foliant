"use client";

import Link from "next/link";
import {useEffect, useState} from "react";
import {useTranslations} from "next-intl";
import {workflowCopy,workflowQueuedCopy} from "@/content/workflows";
import type {ToolAction} from "@/content/tools/actions";
import {studioToolItems} from "@/content/studio-tools";
import {workflowToolChoices} from "@/lib/studio/workflow-tools";
import type {WorkflowRule, WorkflowRun} from "@/lib/studio/workflow-types";
import {useStudioAccount} from "./StudioAccount";

export function StudioWorkflows({locale,workflowId}:{locale:string;workflowId?:string}) {
  const account = useStudioAccount();
  const copy = workflowCopy[locale] ?? workflowCopy.en;
  if (!account.user) return <p className="studio-approval-state">{copy.signIn}</p>;
  return <WorkflowList key={`${account.user.id}:${workflowId ?? "all"}`} locale={locale} workflowId={workflowId} />;
}
function WorkflowList({locale,workflowId}:{locale:string;workflowId?:string}) {
  const copy = workflowCopy[locale] ?? workflowCopy.en;
  const catalog = useTranslations("catalog");
  const [rules,setRules] = useState<WorkflowRule[]>([]);
  const [runs,setRuns] = useState<WorkflowRun[]>([]);
  const [state,setState] = useState<"loading"|"ready"|"error">("loading");
  const [refresh,setRefresh] = useState(0);
  const [creating,setCreating] = useState(false);
  const [editing,setEditing] = useState<string|null>(null);
  const [archive,setArchive] = useState<string|null>(null);
  const [showArchived,setShowArchived] = useState(false);
  const [enabled,setEnabled] = useState(false);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [resume,setResume] = useState<string|null>(null);
  const [name,setName] = useState("");
  const [tool,setTool] = useState("");
  const [size,setSize] = useState("");
  const [initialSize,setInitialSize] = useState<{text:string;bytes:number|null}>({text:"",bytes:null});
  const [email,setEmail] = useState("");
  const [consent,setConsent] = useState(false);
  const toolChoices = workflowToolChoices;
  function openForm(rule?:WorkflowRule) {
    setEditing(rule?.id ?? null);setCreating(true);setResume(null);setArchive(null);
    setName(rule?.name ?? "");setTool(rule?.tool ?? "");
    const sizeText = rule?.maxBytes != null ? String(Number((rule.maxBytes/1024/1024).toFixed(6))) : "";
    setSize(sizeText);setInitialSize({text:sizeText,bytes:rule?.maxBytes ?? null});
    setEmail(rule?.recipientEmail ?? "");setEnabled(rule?.enabled ?? true);
    setConsent(false);setError("");
  }
  const toolLabel = (action:ToolAction|null) => action ? catalog(`tools.${studioToolItems.find(item=>item.tool===action)?.labelKey ?? "reorderPdf"}`) : copy.all;
  useEffect(()=>{
    const controller = new AbortController();
    setState(current => current === "ready" ? current : "loading");
    void fetch(`/api/studio/workflows${workflowId ? `?workflowId=${encodeURIComponent(workflowId)}` : showArchived ? "?archived=true" : ""}`,{cache:"no-store",signal:controller.signal}).then(async response=>{
      if(!response.ok) {const failure = await response.json() as {code?:string};throw new Error(failure.code ?? "unavailable");}
      const body = await response.json() as {rules:WorkflowRule[];runs:WorkflowRun[]};
      if(!controller.signal.aborted) {setRules(body.rules);setRuns(body.runs);setState("ready");}
    }).catch(failure=>{if(!controller.signal.aborted) {setState("error");setError(failure instanceof Error && failure.message==="not_found" ? copy.not_found : copy.unavailable);}});
    return ()=>controller.abort();
  },[workflowId,refresh,showArchived,copy]);
  useEffect(() => {
    if (state !== "ready" || !runs.some(run => run.durable && run.status === "running")) return;
    const refreshVisible = () => {if (document.visibilityState === "visible") setRefresh(value => value+1);};
    const timer = setTimeout(refreshVisible,5000);
    document.addEventListener("visibilitychange",refreshVisible);
    return () => {clearTimeout(timer);document.removeEventListener("visibilitychange",refreshVisible);};
  },[runs,state]);
  async function mutate(url:string,method:string,body:unknown) {
    setBusy(true);setError("");
    try {
      const response = await fetch(url,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
      const result = await response.json() as {code?:string};
      if(!response.ok) throw new Error(result.code ?? "unavailable");
      setCreating(false);setEditing(null);setArchive(null);setResume(null);setConsent(false);setName("");setTool("");setSize("");setEmail("");setRefresh(value=>value+1);
    } catch(failure) {
      const code = failure instanceof Error ? failure.message : "unavailable";
      setError(["invalid_request","recipient_unavailable","limit_reached","not_found"].includes(code) ? copy[code as "invalid_request"] : copy.unavailable);
    } finally {setBusy(false);}
  }
  const date = (value:string)=>new Intl.DateTimeFormat(locale,{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));
  const runReason = (run:WorkflowRun) => run.reason === null
    ? run.durable ? (workflowQueuedCopy[locale] ?? workflowQueuedCopy.en) : Date.now()-Date.parse(run.createdAt)>60000 ? copy.interrupted : copy.running
    : run.reason === "unavailable" ? copy.errorReason : copy[run.reason];
  return <section className="studio-workflows" aria-label={copy.title}>
    <header className="studio-workflow-head">
      {workflowId ? <Link href={`/${locale}/studio/workflows`}>{copy.back}</Link> : <h2>{copy.rules}</h2>}
      <div><button className="studio-approval-icon" type="button" title={copy.refresh} aria-label={copy.refresh} disabled={busy} onClick={()=>setRefresh(value=>value+1)}><i className="ti ti-refresh" aria-hidden="true" /></button>
      {!workflowId ? <button className="studio-button primary" type="button" disabled={busy || state!=="ready" || rules.filter(rule=>!rule.archivedAt).length>=5} onClick={()=>openForm()}><i className="ti ti-plus" aria-hidden="true" />{copy.newRule}</button> : null}</div>
    </header>
    {error ? <p role="alert">{error}</p> : null}
    {state==="loading" ? <p role="status">{copy.loading}</p> : state==="error" ? null : <>
      {!workflowId ? <label className="studio-workflow-archive-filter"><input type="checkbox" checked={showArchived} disabled={busy} onChange={event=>setShowArchived(event.currentTarget.checked)} />{copy.showArchived}</label> : null}
      {creating ? <form className="studio-workflow-form" onSubmit={event=>{event.preventDefault();void mutate(editing ? `/api/studio/workflows/${editing}` : "/api/studio/workflows",editing ? "PATCH" : "POST",{...(editing ? {action:"update",enabled} : {}),name,tool:tool || null,maxBytes:editing && size===initialSize.text ? initialSize.bytes : size ? Math.round(Number(size)*1024*1024) : null,recipientEmail:email,consent});}}>
        <h3>{editing ? copy.editTitle : copy.newRule}</h3>
        {editing ? <p>{copy.editNotice}</p> : null}
        <p className="studio-workflow-chain"><i className="ti ti-file-upload" aria-hidden="true" />{copy.trigger}<i className="ti ti-arrow-right" aria-hidden="true" />{copy.pdf}<i className="ti ti-arrow-right" aria-hidden="true" />{copy.action}</p>
        <fieldset disabled={busy}><label>{copy.name}<input required maxLength={80} value={name} onChange={event=>setName(event.currentTarget.value)} /></label>
        <label>{copy.tool}<select value={tool} onChange={event=>setTool(event.currentTarget.value)}><option value="">{copy.all}</option>{toolChoices.map(item=><option key={item.tool} value={item.tool}>{catalog(`tools.${item.labelKey}`)}</option>)}</select></label>
        <label>{copy.size}<input type="number" min="0.000001" max="953" step="any" value={size} onChange={event=>setSize(event.currentTarget.value)} /></label>
        <label>{copy.recipient}<input required type="email" maxLength={254} value={email} onChange={event=>setEmail(event.currentTarget.value)} /></label>
        {editing ? <label className="studio-workflow-consent"><input type="checkbox" checked={enabled} onChange={event=>setEnabled(event.currentTarget.checked)} /><span>{copy.enabled}</span></label> : null}
        <label className="studio-workflow-consent"><input type="checkbox" checked={consent} required onChange={event=>setConsent(event.currentTarget.checked)} /><span>{copy.consent}</span></label></fieldset>
        <div className="studio-workflow-actions"><button className="studio-button" type="button" disabled={busy} onClick={()=>{setCreating(false);setEditing(null);}}>{copy.cancel}</button><button className="studio-button primary" disabled={busy || !consent} type="submit"><i className={`ti ${editing ? "ti-device-floppy" : "ti-player-play"}`} aria-hidden="true" />{editing ? copy.save : copy.create}</button></div>
      </form> : null}
      {rules.length===0 ? <p>{copy.empty}</p> : <ol className="studio-workflow-list">{rules.map(rule=><li key={rule.id}>
        <div><Link href={`/${locale}/studio/workflows/${rule.id}`}>{rule.name}</Link><small>{copy.trigger} · {copy.pdf} · {toolLabel(rule.tool)}{rule.maxBytes !== null ? ` · ${(rule.maxBytes/1024/1024).toFixed(2)} MB` : ""}</small><small>{copy.action} · {rule.recipientEmail}</small></div>
        <span className="studio-approval-badge" data-status={rule.enabled ? "approved" : "canceled"}>{rule.archivedAt ? copy.archived : rule.enabled ? copy.active : copy.paused}</span>
        <div className="studio-workflow-controls">{!rule.archivedAt ? <>
        <button className="studio-approval-icon" disabled={busy || rule.managementAvailable===false} type="button" title={rule.managementAvailable===false ? copy.migration : copy.edit} aria-label={`${copy.edit}: ${rule.name}`} onClick={()=>openForm(rule)}><i className="ti ti-pencil" aria-hidden="true" /></button>
        <button className="studio-approval-icon" disabled={busy} type="button" title={rule.enabled ? copy.pause : copy.resume} aria-label={`${rule.enabled ? copy.pause : copy.resume}: ${rule.name}`} onClick={()=>{setCreating(false);setArchive(null);if(rule.enabled) void mutate(`/api/studio/workflows/${rule.id}`,"PATCH",{enabled:false});else {setResume(rule.id);setConsent(false);}}}><i className={`ti ${rule.enabled ? "ti-player-pause" : "ti-player-play"}`} aria-hidden="true" /></button>
        <button className="studio-approval-icon" disabled={busy || rule.managementAvailable===false} type="button" title={rule.managementAvailable===false ? copy.migration : copy.archive} aria-label={`${copy.archive}: ${rule.name}`} onClick={()=>{setArchive(rule.id);setResume(null);setCreating(false);}}><i className="ti ti-archive" aria-hidden="true" /></button>
        </> : null}</div>
        {archive===rule.id ? <div className="studio-workflow-resume" role="group" aria-label={copy.archive}><p>{copy.archiveConfirm}</p><div className="studio-workflow-actions"><button className="studio-button" type="button" disabled={busy} onClick={()=>setArchive(null)}>{copy.cancel}</button><button className="studio-button" type="button" disabled={busy} onClick={()=>void mutate(`/api/studio/workflows/${rule.id}`,"PATCH",{action:"archive"})}><i className="ti ti-archive" aria-hidden="true" />{copy.confirmArchive}</button></div></div> : null}
        {resume===rule.id ? <div className="studio-workflow-resume"><p>{copy.resumeConsent}</p><label className="studio-workflow-consent"><input type="checkbox" disabled={busy} checked={consent} onChange={event=>setConsent(event.currentTarget.checked)} /><span>{copy.consent}</span></label><div className="studio-workflow-actions"><button className="studio-button" type="button" disabled={busy} onClick={()=>setResume(null)}>{copy.cancel}</button><button className="studio-button primary" type="button" disabled={busy || !consent} onClick={()=>void mutate(`/api/studio/workflows/${rule.id}`,"PATCH",{enabled:true,consent})}>{copy.confirmResume}</button></div></div> : null}
      </li>)}</ol>}
      {rules.some(rule=>rule.managementAvailable===false) ? <p role="status">{copy.migration}</p> : null}
      {showArchived && rules.length===100 ? <small>{copy.archiveLimit}</small> : null}
      <h2>{copy.runs}</h2>
      {runs.length===0 ? <p>{copy.noRuns}</p> : <ol className="studio-workflow-list">{runs.map(run=><li key={run.id}><div><strong>{run.documentName}</strong><small>{run.workflowName} · {copy.version}</small><time dateTime={run.createdAt}>{date(run.createdAt)}</time><small>{runReason(run)}</small></div><span className="studio-approval-badge" data-status={run.status==="succeeded" ? "approved" : run.status==="failed" ? "rejected" : "canceled"}>{copy[run.status]}</span>{run.approvalId ? <Link className="studio-approval-icon" title={copy.request} aria-label={copy.request} href={`/${locale}/studio/approvals/${run.approvalId}`}><i className="ti ti-arrow-up-right" aria-hidden="true" /></Link> : null}</li>)}</ol>}
      {runs.length===100 ? <small>{copy.limited}</small> : null}
      <p className="studio-workflow-ai"><i className="ti ti-sparkles" aria-hidden="true" />{copy.ai}</p>
    </>}
  </section>;
}
