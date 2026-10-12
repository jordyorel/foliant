import type {Metadata} from "next";
import {getCurrentUser} from "@/lib/auth/server";
import {cookies} from "next/headers";
import {guestSessionCookie} from "@/lib/studio/guest-session";
import {notFound} from "next/navigation";
import {StudioDashboard} from "@/components/studio/StudioDashboard";
import {getStudioCopy} from "@/content/studio";
import {routing, type Locale} from "@/lib/i18n/routing";
import {localizedAlternates, openGraphLocale, siteName} from "@/lib/seo";
import {buildStudioDocuments} from "@/lib/studio/documents";

type Props = {
  params: Promise<{locale: string}>;
};

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {locale: rawLocale} = await params;

  if (!routing.locales.includes(rawLocale as Locale)) {
    notFound();
  }

  const locale = rawLocale as Locale;
  const copy = getStudioCopy(locale);

  return {
    title: copy.metaTitle,
    description: copy.metaDescription,
    alternates: localizedAlternates(locale, "studio"),
    openGraph: {
      title: copy.metaTitle,
      description: copy.metaDescription,
      siteName,
      locale: openGraphLocale(locale),
      type: "website",
      url: `/${locale}/studio`
    },
    twitter: {
      card: "summary_large_image",
      title: copy.metaTitle,
      description: copy.metaDescription
    }
  };
}

export default async function StudioPage({params}: Props) {
  const {locale} = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  let initialDocuments = null;

  try {
    initialDocuments = await buildStudioDocuments({locale, limit: 20, guestSessionId: (await cookies()).get(guestSessionCookie)?.value, userId: (await getCurrentUser())?.id});
  } catch {
    initialDocuments = null;
  }

  return <StudioDashboard initialDocuments={initialDocuments} locale={locale} view="documents" />;
}
