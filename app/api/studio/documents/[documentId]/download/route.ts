import {NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth/server";
import {readWorkspaceDocumentFile} from "@/lib/workspace/documents";
import {recordWorkspaceActivity} from "@/lib/workspace/activity";
import {workspaceFileDisposition} from "@/lib/workspace/file-disposition";

type Props = {
  params: Promise<{documentId: string}>;
};

export async function GET(request: Request, {params}: Props) {
  const {documentId} = await params;
  const user = await getCurrentUser(request);
  const file = await readWorkspaceDocumentFile(documentId, user?.id);

  if (!file) {
    return NextResponse.json({error: "Workspace document not found"}, {status: 404});
  }

  await recordWorkspaceActivity(user!.id, documentId, {action: "download_requested", jobId: file.document.sourceJobId, tool: file.document.kindTool});
  return new Response(file.bytes, {
    headers: {
      "Content-Type": file.document.resultMimeType,
      "Content-Disposition": workspaceFileDisposition(file.document.resultFileName),
      "Cache-Control": "private, max-age=0, no-store"
    }
  });
}
