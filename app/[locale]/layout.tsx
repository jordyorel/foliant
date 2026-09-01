import type {Metadata} from "next";
import {NextIntlClientProvider} from "next-intl";
import {getMessages} from "next-intl/server";
import {notFound} from "next/navigation";
import {routing, type Locale} from "@/lib/i18n/routing";
import {absoluteUrl, siteName, siteOrigin} from "@/lib/seo";
import "../globals.css";

type Props = {
  children: React.ReactNode;
  params: Promise<{locale: string}>;
};

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin()),
  title: {
    default: "Foliant - Traitement de documents en ligne",
    template: `%s | ${siteName}`
  },
  description: "Convertir, compresser, fusionner et signer vos documents directement dans le navigateur.",
  applicationName: siteName,
  creator: siteName,
  publisher: siteName,
  robots: {
    index: true,
    follow: true
  },
  openGraph: {
    siteName,
    type: "website",
    url: absoluteUrl("/fr")
  }
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export default async function LocaleLayout({children, params}: Props) {
  const {locale} = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  const messages = await getMessages();

  return (
    <html lang={locale} data-scroll-behavior="smooth" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/dist/tabler-icons.min.css" />
      </head>
      <body>
        <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
