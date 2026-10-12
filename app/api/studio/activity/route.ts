import {NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth/server";
import {listWorkspaceActivity} from "@/lib/workspace/activity";
import {listWorkspaceDocuments} from "@/lib/workspace/documents";

export const dynamic = "force-dynamic";
const headers = {"Cache-Control": "private, no-store"};

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({error: "Sign in required"}, {status: 401, headers});
  try {
    const events = await listWorkspaceActivity(user.id);
    const documents = await listWorkspaceDocuments({userId: user.id, limit: 100});
    const names = new Map(documents.map(document => [document.id, document.name]));
    return NextResponse.json({events: events.map(event => ({...event, documentName: event.documentId ? names.get(event.documentId) : undefined}))}, {headers});
  }
  catch { return NextResponse.json({error: "Activity unavailable"}, {status: 503, headers}); }
}
