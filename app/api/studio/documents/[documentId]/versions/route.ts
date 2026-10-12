import {NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth/server";
import {isSameOrigin} from "@/lib/auth/config";
import {
  listWorkspaceDocumentVersions,
  restoreWorkspaceDocumentVersion
} from "@/lib/workspace/documents";

type Props = {
  params: Promise<{documentId: string}>;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request, {params}: Props) {
  const {documentId} = await params;
  const versions = await listWorkspaceDocumentVersions(documentId, (await getCurrentUser(request))?.id);
  const latestVersionNumber = Math.max(0, ...versions.map((version) => version.versionNumber));

  return NextResponse.json({
    versions: versions
      .sort((left, right) => right.versionNumber - left.versionNumber)
      .map((version) => ({
        id: version.id,
        versionNumber: version.versionNumber,
        fileName: version.resultFileName,
        mimeType: version.resultMimeType,
        size: version.resultSize,
        pageCount: version.pageCount,
        createdAt: version.createdAt,
        isCurrent: version.versionNumber === latestVersionNumber,
        previewUrl: version.resultMimeType === "application/pdf" && version.kindTool !== "protect_pdf" && !version.isProtected
          ? `/api/studio/documents/${documentId}/versions/${version.id}/preview`
          : undefined,
        downloadUrl: `/api/studio/documents/${documentId}/versions/${version.id}/download`
      }))
  }, {
    headers: {"Cache-Control": "private, max-age=0, no-store"}
  });
}

export async function POST(request: Request, {params}: Props) {
  if (!isSameOrigin(request)) return NextResponse.json({error: "Invalid origin"}, {status: 403});
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({error: "Sign in required"}, {status: 401});
  const {documentId} = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || typeof (body as {versionId?: unknown}).versionId !== "string") {
    return NextResponse.json({error: "Invalid version restore request"}, {status: 400});
  }

  const restored = await restoreWorkspaceDocumentVersion({
    userId: user.id,
    documentId,
    versionId: (body as {versionId: string}).versionId
  });

  if (!restored) {
    return NextResponse.json({error: "Workspace document version not found"}, {status: 404});
  }

  return NextResponse.json({
    id: restored.document.id,
    version: restored.version.versionNumber,
    resultUrl: `/api/studio/documents/${restored.document.id}/download`
  });
}
