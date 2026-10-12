import {notFound} from "next/navigation";
import {routing, type Locale} from "@/lib/i18n/routing";
import {StudioWorkflows} from "@/components/studio/StudioWorkflows";
import {StudioAccountButton} from "@/components/studio/StudioAccount";
import {workflowCopy} from "@/content/workflows";

export const dynamic = "force-dynamic";
export const metadata = {title:"Automation - Foliant Studio",robots:{index:false,follow:false}};
export default async function WorkflowPage({params}:{params:Promise<{locale:string;workflowId:string}>}) {
  const {locale,workflowId} = await params;
  if(!routing.locales.includes(locale as Locale) || !/^[a-f0-9-]{36}$/.test(workflowId)) notFound();
  const copy = workflowCopy[locale] ?? workflowCopy.en;
  return <main className="studio-approval-review"><header><h1>{copy.title}</h1><StudioAccountButton locale={locale} /></header><StudioWorkflows locale={locale} workflowId={workflowId} /></main>;
}
