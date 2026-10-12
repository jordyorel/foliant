import {NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth/server";
import {isSameOrigin} from "@/lib/auth/config";
import {guestSessionId} from "@/lib/studio/guest-session";
import {getStudioDocumentById} from "@/lib/studio/documents";
import {deleteWorkspaceDocument} from "@/lib/workspace/documents";

type Props = {
  params: Promise<{documentId: string}>;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request, {params}: Props) {
  try {
    const {documentId} = await params;
    const {searchParams} = new URL(request.url);
    const locale = searchParams.get("locale") ?? "fr";
    const user = await getCurrentUser(request);
    const document = await getStudioDocumentById({documentId, locale, guestSessionId: guestSessionId(request), userId: user?.id});

    if (!document) {
      return NextResponse.json({error: "Studio document not found"}, {status: 404});
    }

    return NextResponse.json(
      {document},
      {headers: {"Cache-Control": "private, max-age=0, no-store"}}
    );
  } catch {
    return NextResponse.json(
      {error: "Unable to load Studio document"},
      {status: 503, headers: {"Cache-Control": "private, max-age=0, no-store"}}
    );
  }
}

export async function DELETE(request: Request, {params}: Props) {
  if (!isSameOrigin(request)) return NextResponse.json({error: "Invalid origin"}, {status: 403});
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({error: "Sign in required"}, {status: 401});
  try {
    const {documentId} = await params;
    const deleted = await deleteWorkspaceDocument(documentId, user.id);

    if (!deleted) {
      return NextResponse.json({error: "Workspace document not found"}, {status: 404});
    }

    return NextResponse.json({deleted: true, id: documentId});
  } catch {
    return NextResponse.json({error: "Unable to delete workspace document"}, {status: 503});
  }
}
