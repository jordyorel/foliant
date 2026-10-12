import {getCurrentUser} from "@/lib/auth/server";
import {isSameOrigin} from "@/lib/auth/config";
import {findApproval, decideApproval, ApprovalError} from "@/lib/workspace/approvals";
import {publicApproval, type ApprovalDecision} from "@/lib/studio/approval-types";
import {approvalBody, approvalFailure, approvalJson} from "@/lib/studio/approval-api";
import {limitRequest} from "@/lib/validation/rate-limit";

type Props = {params: Promise<{approvalId: string}>};
export const dynamic = "force-dynamic";

export async function GET(request: Request, {params}: Props) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return approvalJson({code: "sign_in_required"}, 401);
    const {approvalId} = await params;
    const record = await findApproval(approvalId, user.id);
    return record ? approvalJson({approval: publicApproval(record, user.id)}) : approvalJson({code: "not_found"}, 404);
  } catch (error) {return approvalFailure(error);}
}

export async function PATCH(request: Request, {params}: Props) {
  if (!isSameOrigin(request)) return approvalJson({code: "invalid_origin"}, 403);
  try {
    const user = await getCurrentUser(request);
    if (!user) return approvalJson({code: "sign_in_required"}, 401);
    const limited = limitRequest(request, "approval", user.id);
    if (limited) return limited;
    const {approvalId} = await params;
    const body = await approvalBody(request);
    if (typeof body.decision !== "string" || !["approved", "rejected", "canceled"].includes(body.decision)) throw new ApprovalError("invalid_request", 400);
    const record = await decideApproval(approvalId, user.id, body.decision as ApprovalDecision, body.comment);
    return approvalJson({approval: publicApproval(record, user.id)});
  } catch (error) {return approvalFailure(error);}
}
