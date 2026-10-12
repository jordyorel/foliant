import {getCurrentUser} from "@/lib/auth/server";
import {isSameOrigin} from "@/lib/auth/config";
import {listApprovals, createApproval, ApprovalError} from "@/lib/workspace/approvals";
import {publicApproval} from "@/lib/studio/approval-types";
import {approvalBody, approvalFailure, approvalJson} from "@/lib/studio/approval-api";
import {limitRequest} from "@/lib/validation/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return approvalJson({code: "sign_in_required"}, 401);
    const documentId = new URL(request.url).searchParams.get("documentId") ?? undefined;
    const records = await listApprovals(user.id, documentId);
    return approvalJson({approvals: records.map(record => publicApproval(record, user.id))});
  } catch (error) {return approvalFailure(error);}
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return approvalJson({code: "invalid_origin"}, 403);
  try {
    const user = await getCurrentUser(request);
    if (!user) return approvalJson({code: "sign_in_required"}, 401);
    const limited = limitRequest(request, "approval", user.id);
    if (limited) return limited;
    const body = await approvalBody(request);
    if (typeof body.documentId !== "string" || typeof body.versionId !== "string") throw new ApprovalError("invalid_request", 400);
    const record = await createApproval({userId: user.id, email: user.email, documentId: body.documentId, versionId: body.versionId, recipientEmail: body.recipientEmail, note: body.note});
    return approvalJson({approval: publicApproval(record, user.id)}, 201);
  } catch (error) {return approvalFailure(error);}
}
