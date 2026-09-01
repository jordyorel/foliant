import type {Metadata} from "next";
import {getTranslations} from "next-intl/server";
import {notFound} from "next/navigation";
import {LandingPage} from "@/components/tool/LandingPage";
import {tools} from "@/content/tools";
import {localizedAlternates, openGraphLocale, siteName} from "@/lib/seo";
import {routing, type Locale} from "@/lib/i18n/routing";

type Props = {
  params: Promise<{locale: string; tool: string}>;
};

export function generateStaticParams() {
  return routing.locales.flatMap((locale) =>
    Object.keys(tools).map((tool) => ({locale, tool}))
  );
}

export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {locale: rawLocale, tool} = await params;
  const toolConfig = tools[tool];

  if (!toolConfig) {
    notFound();
  }

  const locale = routing.locales.includes(rawLocale as Locale) ? rawLocale as Locale : routing.defaultLocale;
  const catalog = await getTranslations({locale, namespace: "catalog"});
  const seo = await getTranslations({locale, namespace: "seo"});
  const toolName = catalog(`tools.${toolConfig.labelKey}`);
  const title = seo("toolTitle", {tool: toolName});
  const description = seo("toolDescription", {tool: toolName});

  return {
    title,
    description,
    alternates: localizedAlternates(locale, tool),
    openGraph: {
      title,
      description,
      siteName,
      locale: openGraphLocale(locale),
      type: "website",
      url: `/${locale}/${tool}`
    },
    twitter: {
      card: "summary_large_image",
      title,
      description
    }
  };
}

export default async function ToolPage({params}: Props) {
  const {locale, tool} = await params;
  if (!tools[tool]) {
    notFound();
  }

  return <LandingPage locale={locale} activeTool={tool} />;
}
