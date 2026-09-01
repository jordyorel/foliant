"use client";

import Link from "next/link";
import {usePathname} from "next/navigation";
import {useTranslations} from "next-intl";
import {routing} from "@/lib/i18n/routing";

type HeaderProps = {
  locale: string;
};

const localeLabels: Record<string, string> = {
  fr: "Français",
  en: "English",
  es: "Español",
  pt: "Português"
};

export function Header({locale}: HeaderProps) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const pathWithoutLocale = pathname.replace(/^\/(fr|en|es|pt)/, "") || "";

  return (
    <header className="topbar">
      <Link className="brand" href={`/${locale}`} aria-label="Accueil Foliant">
        <span className="brand-mark"><i className="ti ti-file-check" aria-hidden="true" /></span>
        <span>Foliant</span>
      </Link>
      <nav className="nav" aria-label={t("label")}>
        <Link href={`/${locale}#outils`}>{t("tools")}</Link>
        <Link href={`/${locale}#parcours`}>{t("flow")}</Link>
        <Link href={`/${locale}#pricing`}>{t("pricing")}</Link>
        <Link href={`/${locale}#faq`}>{t("faq")}</Link>
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
        <Link href={`/${locale}/compresser-pdf`}><strong>{t("start")}</strong></Link>
      </nav>
    </header>
  );
}
