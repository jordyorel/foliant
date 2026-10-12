import {getCurrentUser} from "@/lib/auth/server";
import {isSameOrigin} from "@/lib/auth/config";
import {approvalBody, approvalJson} from "@/lib/studio/approval-api";
import {workflowFailure} from "@/lib/studio/workflow-api";
import {createWorkflow, findWorkflow, listWorkflows, listWorkflowRuns} from "@/lib/workspace/workflows";
import {limitRequest} from "@/lib/validation/rate-limit";
import {after} from "next/server";
import {resumeUserWorkflows} from "@/lib/workspace/workflow-worker";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return approvalJson({code:"sign_in_required"},401);
    const query = new URL(request.url).searchParams;
    const id = query.get("workflowId");
    const rules = id ? [await findWorkflow(user.id,id)] : await listWorkflows(user.id,query.get("archived") === "true");
    const runs = await listWorkflowRuns(user.id);
    if (runs.some(run => run.durable && run.status === "running")) after(() => resumeUserWorkflows(user.id));
    return approvalJson({rules:id ? rules.filter(rule => rule.id === id) : rules,runs:id ? runs.filter(run => run.workflowId === id) : runs});
  } catch (error) {return workflowFailure(error);}
}
export async function POST(request: Request) {
  if (!isSameOrigin(request)) return approvalJson({code:"invalid_origin"},403);
  try {
    const user = await getCurrentUser(request);
    if (!user) return approvalJson({code:"sign_in_required"},401);
    const limited = limitRequest(request,"workflow",user.id);
    if (limited) return limited;
    const rule = await createWorkflow(user.id,user.email,await approvalBody(request));
    return approvalJson({rule},201);
  } catch (error) {return workflowFailure(error);}
}
