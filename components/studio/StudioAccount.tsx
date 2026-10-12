"use client";

import {createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode, type FormEvent} from "react";
import {getAuthCopy} from "@/content/auth";
import {useRouter} from "next/navigation";

type User = {id: string; email: string};
type Account = {user: User | null; requestSignIn: () => Promise<boolean>; signOut: () => Promise<void>; busy: boolean};
const AccountContext = createContext<Account | null>(null);

export function useStudioAccount() {
  const account = useContext(AccountContext);
  if (!account) throw new Error("Studio account provider is missing");
  return account;
}

export function StudioAccountProvider({children, initialUser, configured, locale}: {
  children: ReactNode; initialUser: User | null; configured: boolean; locale: string;
}) {
  const copy = getAuthCopy(locale);
  const router = useRouter();
  const [user, setUser] = useState(initialUser);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);
  const completingRef = useRef(false);

  useEffect(() => { setUser(initialUser); }, [initialUser?.id, initialUser?.email]);
  useEffect(() => {
    if (open) dialog.current?.showModal();
    else dialog.current?.close();
  }, [open]);
  useEffect(() => {
    if (!cooldown) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);
  useEffect(() => () => resolver.current?.(false), []);

  function finish(success: boolean) {
    resolver.current?.(success);
    resolver.current = null;
    setOpen(false);
  }

  async function submit() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth", {
        method: "POST", headers: {"Content-Type": "application/json"},
        body: JSON.stringify({action: "send", email, locale, next: `${window.location.pathname}${window.location.search}`})
      });
      if (!response.ok) {
        throw new Error(response.status === 429 ? copy.rateLimit : response.status === 503 ? copy.unavailable : copy.error);
      }
      const data = await response.json();
      if (data.ok) { setSent(true); setCooldown(60); }
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : copy.error);
    } finally { setBusy(false); }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!busy) void submit();
  }

  const completeSignIn = useCallback(async () => {
    if (busy || completingRef.current) return;
    completingRef.current = true;
    try {
      const response = await fetch("/api/auth", {
        method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "complete"})
      });
      if (!response.ok) return;
      const data = await response.json() as {complete?: boolean; user?: User};
      if (!data.complete || !data.user) return;
      setUser(data.user);
      resolver.current?.(true);
      resolver.current = null;
      setOpen(false);
      setSent(false);
      // Refresh server data without discarding the current Guest editor draft.
      router.refresh();
    } catch {
      // Polling is best effort; the next interval will try again.
    } finally {
      completingRef.current = false;
    }
  }, [busy, router]);

  useEffect(() => {
    if (!sent) return;
    const channel = "BroadcastChannel" in window ? new BroadcastChannel("foliant-auth") : null;
    const check = () => { void completeSignIn(); };
    const onStorage = (event: StorageEvent) => {
      if (event.key === "foliant-auth-complete") check();
    };
    channel?.addEventListener("message", check);
    window.addEventListener("storage", onStorage);
    check();
    const interval = window.setInterval(check, 1500);
    return () => {
      channel?.removeEventListener("message", check);
      channel?.close();
      window.removeEventListener("storage", onStorage);
      window.clearInterval(interval);
    };
  }, [completeSignIn, sent]);

  const account: Account = {
    user, busy,
    requestSignIn() {
      if (user) return Promise.resolve(true);
      resolver.current?.(false);
      setError(""); setOpen(true);
      return new Promise<boolean>((resolve) => { resolver.current = resolve; });
    },
    async signOut() {
      if (busy || !window.confirm(copy.signOutConfirm)) return;
      setBusy(true);
      try {
        const response = await fetch("/api/auth", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({action: "signout"})});
        if (!response.ok) throw new Error(copy.error);
        setUser(null);
        // Clear any already-rendered private document after signing out.
        window.location.assign(`/${locale}/studio`);
      } catch { window.alert(copy.error); }
      finally { setBusy(false); }
    }
  };

  return <AccountContext.Provider value={account}>
    {children}
    <dialog className="studio-auth-dialog" ref={dialog} aria-labelledby="studio-auth-title"
      onCancel={(event) => { event.preventDefault(); if (!busy) finish(false); }}
      onClose={() => { if (open) finish(false); }}>
      <button className="studio-auth-close" type="button" aria-label={copy.close} title={copy.close} disabled={busy} onClick={() => finish(false)}>
        <i className="ti ti-x" aria-hidden="true" />
      </button>
      <h2 id="studio-auth-title">{copy.title}</h2>
      <p>{configured ? sent ? copy.sent : copy.intro : copy.unavailable}</p>
      {configured ? <form onSubmit={onSubmit}>
        <label htmlFor="studio-auth-email">{copy.email}</label>
        <input id="studio-auth-email" type="email" autoComplete="email" required maxLength={254} disabled={busy || sent} value={email} onChange={(event) => setEmail(event.target.value)} />
        {error ? <p className="studio-auth-error" role="alert">{error}</p> : null}
        {!sent ? <button className="studio-button primary" type="submit" disabled={busy}>
          <i className={`ti ${busy ? "ti-loader-2" : "ti-arrow-right"}`} aria-hidden="true" />
          <span>{busy ? copy.wait : copy.send}</span>
        </button> : null}
        {sent ? <div className="studio-auth-secondary">
          <button type="button" disabled={busy} onClick={() => {setSent(false); setError("");}}>{copy.change}</button>
          <button type="button" disabled={busy || cooldown > 0} onClick={() => void submit()}>{copy.resend}{cooldown > 0 ? ` (${cooldown})` : ""}</button>
        </div> : null}
      </form> : null}
    </dialog>
  </AccountContext.Provider>;
}

export function StudioAccountButton({locale}: {locale: string}) {
  const {user, requestSignIn, signOut, busy} = useStudioAccount();
  const copy = getAuthCopy(locale);
  return <div className="studio-account-controls">
    {user ? <>
      <span title={user.email}>{user.email}</span>
      <button type="button" title={copy.signOut} aria-label={copy.signOut} disabled={busy} onClick={() => void signOut()}><i className="ti ti-logout" aria-hidden="true" /></button>
    </> : <button type="button" onClick={() => void requestSignIn()}><i className="ti ti-user" aria-hidden="true" /><span>{copy.signIn}</span></button>}
  </div>;
}
