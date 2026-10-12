import type {Metadata} from "next";
import {getCurrentUser} from "@/lib/auth/server";
import {cookies} from "next/headers";
import {guestSessionCookie} from "@/lib/studio/guest-session";
import {notFound} from "next/navigation";
import {StudioDashboard} from "@/components/studio/StudioDashboard";
import {getStudioCopy, isStudioViewKey, studioViewKeys} from "@/content/studio";
import {routing, type Locale} from "@/lib/i18n/routing";
import {localizedAlternates, openGraphLocale, siteName} from "@/lib/seo";
import {buildStudioDocuments} from "@/lib/studio/documents";

type Props = {
  params: Promise<{locale: string; view: string}>;
};

export const dynamic = "force-dynamic";

export function generateStaticParams() {
  return routing.locales.flatMap((locale) => (
    studioViewKeys
      .filter((view) => view !== "documents")
      .map((view) => ({locale, view}))
  ));
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {locale: rawLocale, view: rawView} = await params;

  if (!routing.locales.includes(rawLocale as Locale) || !isStudioViewKey(rawView) || rawView === "documents") {
    notFound();
  }

  const locale = rawLocale as Locale;
  const copy = getStudioCopy(locale);
  const viewCopy = copy.views[rawView];
  const title = `${viewCopy.title} - Foliant Studio`;

  return {
    title,
    description: viewCopy.subtitle,
    alternates: localizedAlternates(locale, `studio/${rawView}`),
    openGraph: {
      title,
      description: viewCopy.subtitle,
      siteName,
      locale: openGraphLocale(locale),
      type: "website",
      url: `/${locale}/studio/${rawView}`
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: viewCopy.subtitle
    }
  };
}

export default async function StudioModulePage({params}: Props) {
  const {locale, view} = await params;

  if (!routing.locales.includes(locale as Locale) || !isStudioViewKey(view) || view === "documents") {
    notFound();
  }

  let initialDocuments = null;

  try {
    initialDocuments = await buildStudioDocuments({locale, limit: 20, guestSessionId: (await cookies()).get(guestSessionCookie)?.value, userId: (await getCurrentUser())?.id});
  } catch {
    initialDocuments = null;
  }

  return <StudioDashboard initialDocuments={initialDocuments} locale={locale} view={view} />;
}
