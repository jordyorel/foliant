"use client";

import {useEffect, useRef, useState} from "react";

let internalNavigation = false;
let activeClient: {jobId: string; clientId: string} | null = null;
const transferKey = "foliant_guest_transfer";

function release(client: {jobId: string; clientId: string}) {
  const url = `/api/jobs/${encodeURIComponent(client.jobId)}/close`;
  const body = JSON.stringify({clientId: client.clientId});
  if (!navigator.sendBeacon(url, new Blob([body], {type: "application/json"}))) {
    void fetch(url, {method: "POST", body, keepalive: true, headers: {"Content-Type": "application/json"}}).catch(() => undefined);
  }
}

export function navigateWithinStudio(url: string) {
  internalNavigation = true;
  if (activeClient) {
    const nextJob = new URL(url, location.origin).pathname.match(/\/documents\/(job_[a-zA-Z0-9_-]+)$/)?.[1];
    if (nextJob) {
      try { sessionStorage.setItem(transferKey, JSON.stringify({...activeClient, jobId: nextJob, expires: Date.now() + 30_000})); }
      catch { /* The six-hour TTL remains the fallback if storage is unavailable. */ }
    } else release(activeClient);
  }
  if (history.state?.foliantGuestGuard) window.location.replace(url);
  else window.location.assign(url);
}

const messages: Record<string, {title: string; body: string; leave: string; stay: string}> = {
  fr: {title: "Quitter le document ?", body: "Ce document est temporaire. Téléchargez-le ou enregistrez-le dans votre compte avant de quitter. Il reste disponible si vous le gardez ouvert dans un autre onglet.", leave: "Quitter", stay: "Continuer à modifier"},
  en: {title: "Leave this document?", body: "This document is temporary. Download it or save it to your account before leaving. It remains available if you keep it open in another tab.", leave: "Leave", stay: "Keep editing"},
  es: {title: "¿Salir del documento?", body: "Este documento es temporal. Descárgalo o guárdalo en tu cuenta antes de salir. Sigue disponible si está abierto en otra pestaña.", leave: "Salir", stay: "Seguir editando"},
  pt: {title: "Sair do documento?", body: "Este documento é temporário. Baixe-o ou salve-o na sua conta antes de sair. Ele continua disponível se estiver aberto em outra aba.", leave: "Sair", stay: "Continuar editando"}
};

export function useGuestSessionLifecycle(jobId: string, enabled: boolean, locale: string) {
  const generation = useRef(0);
  const clientRef = useRef<{jobId: string; clientId: string} | null>(null);
  const leaving = useRef(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const [destination, setDestination] = useState<string | null>(null);
  const copy = messages[locale] ?? messages.en;

  useEffect(() => {
    if (destination) dialog.current?.showModal();
    else dialog.current?.close();
  }, [destination]);

  useEffect(() => {
    const currentGeneration = ++generation.current;
    if (!enabled) return;
    internalNavigation = false;
    leaving.current = false;
    if (clientRef.current?.jobId !== jobId) {
      let clientId = crypto.randomUUID();
      try {
        const transfer = JSON.parse(sessionStorage.getItem(transferKey) ?? "null");
        sessionStorage.removeItem(transferKey);
        if (transfer?.jobId === jobId && transfer.expires > Date.now()) clientId = transfer.clientId;
      } catch { /* Session storage is optional. */ }
      clientRef.current = {jobId, clientId};
    }
    const client = clientRef.current;
    activeClient = client;
    const activation = fetch(`/api/jobs/${encodeURIComponent(jobId)}/session`, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify({clientId: client.clientId}), keepalive: true
    }).catch(() => null);
    const currentUrl = location.href;
    if (history.state?.foliantGuestGuard !== client.clientId) {
      history.pushState({...history.state, foliantGuestGuard: client.clientId}, "", currentUrl);
    }
    const close = () => { if (!internalNavigation) release(client); };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (internalNavigation || leaving.current) return;
      event.preventDefault(); event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href);
      if (url.origin === location.origin && (url.pathname.startsWith("/api/") || (url.pathname === location.pathname && url.search === location.search))) return;
      event.preventDefault(); event.stopPropagation();
      setDestination(url.href);
    };
    const pop = () => {
      if (internalNavigation || leaving.current) return;
      const target = location.href === currentUrl ? "back" : location.href;
      history.pushState({...history.state, foliantGuestGuard: client.clientId}, "", currentUrl);
      setDestination(target);
    };
    const restored = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      // A cached page is not evidence that a revoked result is still available.
      leaving.current = true;
      location.reload();
    };
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("pagehide", close);
    window.addEventListener("pageshow", restored);
    window.addEventListener("popstate", pop);
    window.document.addEventListener("click", click, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("pagehide", close);
      window.removeEventListener("pageshow", restored);
      window.removeEventListener("popstate", pop);
      window.document.removeEventListener("click", click, true);
      // Strict Mode's simulated unmount is cancelled by the next generation.
      void activation.then(() => queueMicrotask(() => {
        if (generation.current === currentGeneration) close();
      }));
    };
  }, [jobId, enabled]);

  function confirmLeave() {
    const target = destination;
    leaving.current = true;
    if (clientRef.current) release(clientRef.current);
    if (target === "back") history.go(-2);
    else if (target) location.assign(target);
  }

  return enabled ? <dialog ref={dialog} className="studio-auth-dialog" aria-labelledby="guest-leave-title"
    onCancel={(event) => {event.preventDefault(); setDestination(null);}}>
    <h2 id="guest-leave-title">{copy.title}</h2>
    <p>{copy.body}</p>
    <div className="studio-delete-dialog-actions">
      <button type="button" onClick={() => setDestination(null)}>{copy.stay}</button>
      <button type="button" onClick={confirmLeave}>{copy.leave}</button>
    </div>
  </dialog> : null;
}
