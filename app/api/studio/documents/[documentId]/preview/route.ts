import {NextResponse} from "next/server";
import {workspaceFileDisposition} from "@/lib/workspace/file-disposition";
import {getCurrentUser} from "@/lib/auth/server";
import {readWorkspaceDocumentFile} from "@/lib/workspace/documents";

type Props = {
  params: Promise<{documentId: string}>;
};

export async function GET(request: Request, {params}: Props) {
  const {documentId} = await params;
  const file = await readWorkspaceDocumentFile(documentId, (await getCurrentUser(request))?.id);

  if (!file) {
    return NextResponse.json({error: "Workspace document not found"}, {status: 404});
  }

  if (file.document.resultMimeType !== "application/pdf") {
    return NextResponse.json({error: "Preview is only available for PDF documents"}, {status: 415});
  }

  return new Response(file.bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": workspaceFileDisposition(file.document.resultFileName,true),
      "Cache-Control": "private, max-age=0, no-store"
    }
  });
}
