import {NextResponse} from "next/server";
import {workspaceFileDisposition} from "@/lib/workspace/file-disposition";
import {getCurrentUser} from "@/lib/auth/server";
import {readWorkspaceDocumentVersionFile} from "@/lib/workspace/documents";
import {recordWorkspaceActivity} from "@/lib/workspace/activity";

type Props = {
  params: Promise<{documentId: string; versionId: string}>;
};

export async function GET(request: Request, {params}: Props) {
  const {documentId, versionId} = await params;
  const user = await getCurrentUser(request);
  const file = await readWorkspaceDocumentVersionFile(documentId, versionId, user?.id);

  if (!file) {
    return NextResponse.json({error: "Workspace document version not found"}, {status: 404});
  }

  await recordWorkspaceActivity(user!.id, documentId, {action: "download_requested", jobId: file.version.sourceJobId, versionNumber: file.version.versionNumber, tool: file.version.kindTool});
  return new Response(file.bytes, {
    headers: {
      "Content-Type": file.version.resultMimeType,
      "Content-Disposition": workspaceFileDisposition(file.version.resultFileName),
      "Cache-Control": "private, max-age=0, no-store"
    }
  });
}
