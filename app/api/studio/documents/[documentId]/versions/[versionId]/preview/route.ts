import {NextResponse} from "next/server";
import {workspaceFileDisposition} from "@/lib/workspace/file-disposition";
import {getCurrentUser} from "@/lib/auth/server";
import {readWorkspaceDocumentVersionFile} from "@/lib/workspace/documents";

type Props = {
  params: Promise<{documentId: string; versionId: string}>;
};

export async function GET(request: Request, {params}: Props) {
  const {documentId, versionId} = await params;
  const file = await readWorkspaceDocumentVersionFile(documentId, versionId, (await getCurrentUser(request))?.id);

  if (!file) {
    return NextResponse.json({error: "Workspace document version not found"}, {status: 404});
  }

  if (file.version.resultMimeType !== "application/pdf") {
    return NextResponse.json({error: "Preview is only available for PDF documents"}, {status: 415});
  }

  return new Response(file.bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": workspaceFileDisposition(file.version.resultFileName,true),
      "Cache-Control": "private, max-age=0, no-store"
    }
  });
}
