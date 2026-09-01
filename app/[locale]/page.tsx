import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {HomePage as MarketingHomePage} from "@/components/home/HomePage";
import {localizedAlternates, openGraphLocale, siteName} from "@/lib/seo";
import {routing, type Locale} from "@/lib/i18n/routing";

type Props = {
  params: Promise<{locale: string}>;
};

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {locale: rawLocale} = await params;
  const locale = routing.locales.includes(rawLocale as Locale) ? rawLocale as Locale : routing.defaultLocale;
  const t = await getTranslations({locale, namespace: "homepage"});
  const title = t("metaTitle");
  const description = t("metaDescription");

  return {
    title,
    description,
    alternates: localizedAlternates(locale),
    openGraph: {
      title,
      description,
      siteName,
      locale: openGraphLocale(locale),
      type: "website",
      url: `/${locale}`
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export default async function HomePage({params}: Props) {
  const {locale} = await params;
  return <MarketingHomePage locale={locale} />;
}
