import {getCurrentUser} from "@/lib/auth/server";
import {isSameOrigin} from "@/lib/auth/config";
import {approvalBody, approvalJson} from "@/lib/studio/approval-api";
import {workflowFailure} from "@/lib/studio/workflow-api";
import {archiveWorkflow, setWorkflowEnabled, updateWorkflow, WorkflowError} from "@/lib/workspace/workflows";
import {limitRequest} from "@/lib/validation/rate-limit";

export const dynamic = "force-dynamic";
export async function PATCH(request: Request, context:{params:Promise<{workflowId:string}>}) {
  if (!isSameOrigin(request)) return approvalJson({code:"invalid_origin"},403);
  try {
    const user = await getCurrentUser(request);
    if (!user) return approvalJson({code:"sign_in_required"},401);
    const limited = limitRequest(request,"workflow",user.id);
    if (limited) return limited;
    const body = await approvalBody(request);
    const {workflowId} = await context.params;
    if (body.action === "archive") return approvalJson({rule:await archiveWorkflow(user.id,workflowId)});
    if (body.action === "update") return approvalJson({rule:await updateWorkflow(user.id,user.email,workflowId,body)});
    if (body.action !== undefined) throw new WorkflowError("invalid_request",400);
    if (typeof body.enabled !== "boolean") throw new WorkflowError("invalid_request",400);
    // Resuming a rule authorizes future sharing again; pausing never revokes old requests.
    if (body.enabled && body.consent !== true) throw new WorkflowError("invalid_request",400);
    return approvalJson({rule:await setWorkflowEnabled(user.id,workflowId,body.enabled)});
  } catch (error) {return workflowFailure(error);}
}
