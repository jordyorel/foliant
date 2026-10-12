import {NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth/server";
import {canAccessGuestJob, getJob, listGuestActivity} from "@/lib/jobs";
import {guestSessionId} from "@/lib/studio/guest-session";
import {findWorkspaceDocument} from "@/lib/workspace/documents";
import {listWorkspaceActivity} from "@/lib/workspace/activity";

export const dynamic = "force-dynamic";
const headers = {"Cache-Control": "private, no-store"};
export async function GET(request: Request, {params}: {params: Promise<{documentId: string}>}) {
  const {documentId} = await params;
  try {
    if (documentId.startsWith("job_")) {
      const session = guestSessionId(request);
      if (!canAccessGuestJob(getJob(documentId), session)) return NextResponse.json({error: "Document not found"}, {status: 404, headers});
      return NextResponse.json({events: listGuestActivity(documentId, session)}, {headers});
    }
    const user = await getCurrentUser(request);
    if (!await findWorkspaceDocument(documentId, user?.id)) return NextResponse.json({error: "Document not found"}, {status: 404, headers});
    return NextResponse.json({events: await listWorkspaceActivity(user!.id, documentId)}, {headers});
  } catch { return NextResponse.json({error: "Activity unavailable"}, {status: 503, headers}); }
}
