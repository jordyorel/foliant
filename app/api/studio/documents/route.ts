import {after, NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth/server";
import {isSameOrigin} from "@/lib/auth/config";
import {canAccessGuestJob, getJob} from "@/lib/jobs";
import {guestSessionId} from "@/lib/studio/guest-session";
import {buildStudioDocuments} from "@/lib/studio/documents";
import {cleanupExpiredFiles} from "@/lib/storage/local";
import {appendJobResultToWorkspaceDocument, saveJobResultToWorkspace} from "@/lib/workspace/documents";
import {enqueueDocumentWorkflows} from "@/lib/workspace/workflows";
import {resumeUserWorkflows} from "@/lib/workspace/workflow-worker";
import {logOperationalEvent} from "@/lib/operations/log";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await cleanupExpiredFiles();

    const {searchParams} = new URL(request.url);
    const locale = searchParams.get("locale") ?? "fr";
    const user = await getCurrentUser(request);
    const documents = await buildStudioDocuments({locale, limit: 20, guestSessionId: guestSessionId(request), userId: user?.id});

    return NextResponse.json(
      {documents},
      {
        headers: {
          "Cache-Control": "private, max-age=0, no-store"
        }
      }
    );
  } catch {
    return NextResponse.json(
      {error: "Unable to load Studio documents"},
      {status: 503, headers: {"Cache-Control": "private, max-age=0, no-store"}}
    );
  }
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({error: "Invalid origin"}, {status: 403});
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({error: "Sign in to save documents"}, {status: 401});
  const body = await request.json().catch(() => null);

  if (!body || typeof body !== "object" || typeof (body as {jobId?: unknown}).jobId !== "string") {
    return NextResponse.json({error: "Invalid save request"}, {status: 400});
  }

  const {documentId, jobId} = body as {documentId?: unknown; jobId: string};

  if (!canAccessGuestJob(getJob(jobId), guestSessionId(request))) {
    return NextResponse.json({error: "Completed result not found"}, {status: 404});
  }

  if (documentId !== undefined && typeof documentId !== "string") {
    return NextResponse.json({error: "Invalid document id"}, {status: 400});
  }

  try {
    const saved = typeof documentId === "string"
      ? await appendJobResultToWorkspaceDocument({documentId, jobId, userId: user.id})
      : await saveJobResultToWorkspace(jobId, user.id);
    const document = saved && "document" in saved ? saved.document : saved;

    if (!document) {
      return NextResponse.json({error: "Completed result not found"}, {status: 404});
    }

    let workflows: "queued" | "unavailable" | "not_triggered" = "not_triggered";
    if (documentId === undefined) {
      try {
        if (!document.workflowsQueued) await enqueueDocumentWorkflows(user.id,user.email,document.id);
        workflows = "queued";
        after(() => resumeUserWorkflows(user.id));
      }
      catch {workflows = "unavailable"; logOperationalEvent("workflow_failed");}
    }
    return NextResponse.json({
      id: document.id,
      workflows,
      version: saved && "version" in saved ? saved.version.versionNumber : 1,
      resultUrl: `/api/studio/documents/${document.id}/download`
    }, {headers: {"Cache-Control": "private, no-store"}});
  } catch {
    return NextResponse.json({error: "Unable to save Studio document"}, {status: 503});
  }
}
