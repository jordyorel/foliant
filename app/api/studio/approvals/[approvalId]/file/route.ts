import {getCurrentUser} from "@/lib/auth/server";
import {readApprovalFile} from "@/lib/workspace/approvals";
import {approvalFailure, approvalJson} from "@/lib/studio/approval-api";

export const dynamic = "force-dynamic";
type Props = {params: Promise<{approvalId: string}>};
export async function GET(request: Request, {params}: Props) {
  try {
    const user = await getCurrentUser(request);
    if (!user) return approvalJson({code: "sign_in_required"}, 401);
    const {approvalId} = await params;
    const file = await readApprovalFile(approvalId, user.id);
    if (!file) return approvalJson({code: "not_found"}, 404);
    return new Response(new Uint8Array(file.bytes), {headers: {
      "Content-Type": file.version.resultMimeType,
      "Content-Disposition": `inline; filename="document-v${file.version.versionNumber}.pdf"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "sandbox"
    }});
  } catch (error) {return approvalFailure(error);}
}
