"use client";

import Link from "next/link";
import {useEffect, useState} from "react";
import {useTranslations} from "next-intl";
import {activityCopy} from "@/content/activity";
import {studioToolItems} from "@/content/studio-tools";
import type {ActivityEvent} from "@/lib/studio/activity-types";

export function StudioActivity({documentId, locale, signedIn = false}: {documentId?: string; locale: string; signedIn?: boolean}) {
  const copy = activityCopy[locale as keyof typeof activityCopy] ?? activityCopy.en;
  const catalog = useTranslations("catalog");
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [refresh, setRefresh] = useState(0);
  const url = documentId ? `/api/studio/documents/${encodeURIComponent(documentId)}/activity` : "/api/studio/activity";
  useEffect(() => {
    if (!documentId && !signedIn) return;
    const controller = new AbortController();
    setState("loading");
    async function load() {
      try {
        const response = await fetch(url, {cache: "no-store", signal: controller.signal});
        if (!response.ok) throw new Error("Activity unavailable");
        const data = await response.json() as {events: ActivityEvent[]};
        if (!controller.signal.aborted) { setEvents(data.events); setState("ready"); }
      } catch { if (!controller.signal.aborted) setState("error"); }
    }
    void load();
    return () => controller.abort();
  }, [documentId, signedIn, url, refresh]);
  useEffect(() => {
    const update = () => setRefresh(value => value + 1);
    window.addEventListener("focus", update);
    return () => window.removeEventListener("focus", update);
  }, []);

  return <section className="studio-event-history" aria-label={copy.title}>
    <header><h2>{copy.title}</h2><button type="button" title={copy.refresh} aria-label={copy.refresh} onClick={() => setRefresh(value => value + 1)}><i className="ti ti-refresh" aria-hidden="true" /></button></header>
    {!documentId && !signedIn ? <p>{copy.signIn}</p> : state === "loading" ? <p role="status">{copy.loading}</p> : state === "error" ? <p role="alert">{copy.error}</p> : events.length === 0 ? <p>{copy.empty}</p> : <ol>
      {events.map(event => {
        const tool = studioToolItems.find(item => item.tool === event.tool);
        return <li key={event.id}>
        <i className={`ti ${event.action === "processing_failed" ? "ti-alert-circle" : event.action === "deleted" ? "ti-trash" : event.action === "download_requested" ? "ti-download" : "ti-history"}`} aria-hidden="true" />
        <div><span>{copy.actions[event.action]}</span>
          {tool ? <small>{catalog(`tools.${tool.labelKey}`)}</small> : null}
          {!documentId && event.documentName ? <small title={event.documentName}>{event.documentName}</small> : null}
          {event.versionNumber ? <small>{copy.version} {event.versionNumber}</small> : null}
          <time dateTime={event.createdAt}>{new Intl.DateTimeFormat(locale, {dateStyle: "medium", timeStyle: "short"}).format(new Date(event.createdAt))}</time>
        </div>
        {!documentId && event.documentId && event.documentName && event.action !== "deleted" ? <Link href={`/${locale}/studio/documents/${event.documentId}`} title={copy.open} aria-label={copy.open}><i className="ti ti-arrow-up-right" aria-hidden="true" /></Link> : null}
      </li>;
      })}
    </ol>}
  </section>;
}
