import {notFound} from "next/navigation";
import {LandingPage} from "@/components/tool/LandingPage";
import {tools} from "@/content/tools";

type Props = {
  params: Promise<{locale: string; tool: string}>;
};

export function generateStaticParams() {
  return ["fr", "en", "es", "pt"].flatMap((locale) =>
    Object.keys(tools).map((tool) => ({locale, tool}))
  );
}

export default async function ToolPage({params}: Props) {
  const {locale, tool} = await params;
  if (!tools[tool]) {
    notFound();
  }

  return <LandingPage locale={locale} activeTool={tool} />;
}
