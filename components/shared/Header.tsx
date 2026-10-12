"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useTranslations} from "next-intl";
import {useEffect, useRef, useState} from "react";
import {routing} from "@/lib/i18n/routing";

type HeaderProps = {
  locale: string;
};

type CurrentUser = {id: string; email: string};

const localeLabels: Record<string, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  pt: "Português"
};

export function Header({locale}: HeaderProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);
  const pathWithoutLocale = pathname.replace(/^\/(fr|en|es|pt)/, "") || "";

  useEffect(() => {
    let active = true;
    let controller: AbortController | null = null;
    const refresh = () => {
      controller?.abort();
      const request = new AbortController();
      controller = request;
      void fetch("/api/auth", {cache: "no-store", signal: request.signal})
      .then(async (response) => response.ok ? response.json() as Promise<{user: CurrentUser | null}> : null)
      .then((data) => {
        if (active && !request.signal.aborted) setUser(data?.user ?? null);
      })
      .catch(() => {
        // A failed refresh must not present a signed-in visitor as signed out.
      });
    };
    const channel = "BroadcastChannel" in window ? new BroadcastChannel("foliant-auth") : null;
    const onStorage = (event: StorageEvent) => { if (event.key === "foliant-auth-complete") refresh(); };
    refresh();
    window.addEventListener("focus", refresh);
    window.addEventListener("storage", onStorage);
    channel?.addEventListener("message", refresh);

    return () => {
      active = false;
      controller?.abort();
      window.removeEventListener("focus", refresh);
      window.removeEventListener("storage", onStorage);
      channel?.close();
    };
  }, []);

  useEffect(() => {
    const closeMenus = () => headerRef.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((menu) => { menu.open = false; });
    const outside = (event: PointerEvent) => { if (!headerRef.current?.contains(event.target as Node)) closeMenus(); };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const openMenu = headerRef.current?.querySelector<HTMLDetailsElement>("details[open]");
      closeMenus();
      openMenu?.querySelector<HTMLElement>("summary")?.focus();
    };
    window.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", keyboard);
    return () => { window.removeEventListener("pointerdown", outside); window.removeEventListener("keydown", keyboard); };
  }, []);

  return (
    <header className="topbar" ref={headerRef} onClick={(event) => {
      if ((event.target as HTMLElement).closest("a")) headerRef.current?.querySelectorAll<HTMLDetailsElement>("details[open]").forEach((menu) => { menu.open = false; });
    }}>
      <Link className="brand" href={`/${locale}`} aria-label="Foliant">
        <span className="brand-mark"><i className="ti ti-file-check" aria-hidden="true" /></span>
        <span>Foliant</span>
      </Link>
      <nav className="nav nav-main" aria-label={t("label")}>
        <Link href={`/${locale}#outils`}>{t("tools")}</Link>
        <Link href={`/${locale}#parcours`}>{t("flow")}</Link>
        <Link href={`/${locale}#faq`}>{t("faq")}</Link>
        <Link href={`/${locale}/studio`}>{t("studio")}</Link>
      </nav>
      <div className="nav-actions">
        <details className="language-menu">
          <summary aria-label={t("language")}>
            <i className="ti ti-world" aria-hidden="true" />
            <span>{localeLabels[locale]}</span>
            <i className="ti ti-chevron-down" aria-hidden="true" />
          </summary>
          <div className="language-list">
            {routing.locales.map((targetLocale) => (
              <Link
                className={targetLocale === locale ? "active" : ""}
                href={`/${targetLocale}${pathWithoutLocale}`}
                hrefLang={targetLocale}
                key={targetLocale}
              >
                {localeLabels[targetLocale]}
              </Link>
            ))}
          </div>
        </details>
        <Link className="nav-account" href={`/${locale}/studio`} title={user?.email} aria-label={user ? t("signedIn") : t("signIn")}>
          <i className={`ti ${user ? "ti-circle-check" : "ti-user"}`} aria-hidden="true" />
          <span>{user ? t("signedIn") : t("signIn")}</span>
        </Link>
        <Link className="nav-start" href={`/${locale}/compresser-pdf`}><strong>{t("start")}</strong></Link>
        <details className="nav-mobile">
          <summary aria-label={t("label")}><i className="ti ti-menu-2" aria-hidden="true" /></summary>
          <nav aria-label={t("label")}>
            <Link href={`/${locale}#outils`}>{t("tools")}</Link>
            <Link href={`/${locale}#parcours`}>{t("flow")}</Link>
            <Link href={`/${locale}#faq`}>{t("faq")}</Link>
            <Link href={`/${locale}/studio`}>{t("studio")}</Link>
          </nav>
        </details>
      </div>
    </header>
  );
}
