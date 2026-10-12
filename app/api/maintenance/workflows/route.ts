import {NextResponse} from "next/server";
import {authorizeMaintenance} from "@/lib/jobs/maintenance-auth";
import {processQueuedWorkflows} from "@/lib/workspace/workflows";
import {logOperationalEvent} from "@/lib/operations/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const denied = authorizeMaintenance(request);
  if (denied) return denied;
  const headers = {"Cache-Control":"no-store"};
  try {return NextResponse.json({processed:await processQueuedWorkflows(undefined,10)},{headers});}
  catch {
    logOperationalEvent("workflow_failed");
    return NextResponse.json({error:"Workflow processing unavailable"},{status:503,headers});
  }
}
