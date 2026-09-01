import {routing, type Locale} from "@/lib/i18n/routing";

export const siteName = "Foliant";

const openGraphLocales: Record<Locale, string> = {
  fr: "fr_FR",
  en: "en_US",
  es: "es_ES",
  pt: "pt_PT"
};

export function siteOrigin() {
  return (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export function absoluteUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${siteOrigin()}${normalizedPath}`;
}

export function localizedAlternates(locale: Locale, path = "") {
  const normalizedPath = path ? `/${path.replace(/^\/+/, "")}` : "";

  return {
    canonical: `/${locale}${normalizedPath}`,
    languages: {
      ...Object.fromEntries(routing.locales.map((targetLocale) => [
        targetLocale,
        `/${targetLocale}${normalizedPath}`
      ])),
      "x-default": `/${routing.defaultLocale}${normalizedPath}`
    }
  };
}

export function openGraphLocale(locale: Locale) {
  return openGraphLocales[locale];
}
