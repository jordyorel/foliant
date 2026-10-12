import type {Metadata} from "next";
import {getCurrentUser} from "@/lib/auth/server";
import {cookies} from "next/headers";
import {guestSessionCookie} from "@/lib/studio/guest-session";
import {notFound} from "next/navigation";
import {StudioDocumentWorkspace} from "@/components/studio/StudioDocumentWorkspace";
import {getStudioCopy} from "@/content/studio";
import {routing, type Locale} from "@/lib/i18n/routing";
import {localizedAlternates, openGraphLocale, siteName} from "@/lib/seo";
import {getStudioDocumentById} from "@/lib/studio/documents";

type Props = {
  params: Promise<{documentId: string; locale: string}>;
  searchParams: Promise<{tool?: string}>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {documentId, locale: rawLocale} = await params;

  if (!routing.locales.includes(rawLocale as Locale)) {
    notFound();
  }

  const locale = rawLocale as Locale;
  const copy = getStudioCopy(locale);
  const title = `${copy.workspace.details} - Foliant Studio`;

  return {
    title,
    description: copy.workspace.subtitle,
    alternates: localizedAlternates(locale, `studio/documents/${documentId}`),
    openGraph: {
      title,
      description: copy.workspace.subtitle,
      siteName,
      locale: openGraphLocale(locale),
      type: "website",
      url: `/${locale}/studio/documents/${documentId}`
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: copy.workspace.subtitle
    }
  };
}

export default async function StudioDocumentPage({params, searchParams}: Props) {
  const {documentId, locale} = await params;
  const {tool} = await searchParams;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  let initialDocument = null;

  try {
    initialDocument = await getStudioDocumentById({documentId, locale, guestSessionId: (await cookies()).get(guestSessionCookie)?.value, userId: (await getCurrentUser())?.id});
  } catch {
    initialDocument = null;
  }

  return (
    <StudioDocumentWorkspace
      documentId={documentId}
      initialDocument={initialDocument}
      locale={locale}
      initialTool={tool === "fill_pdf" || tool === "sign_pdf" ? tool : undefined}
    />
  );
}
