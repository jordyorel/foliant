import {NextResponse} from "next/server";
import {touchGuestClient} from "@/lib/jobs";
import {isSameOrigin} from "@/lib/auth/config";
import {guestSessionId} from "@/lib/studio/guest-session";

export async function POST(request: Request, {params}: {params: Promise<{jobId: string}>}) {
  if (!isSameOrigin(request)) return NextResponse.json({error: "Invalid origin"}, {status: 403});
  const body = await request.json().catch(() => null);
  if (typeof body?.clientId !== "string" || !/^[a-f0-9-]{36}$/.test(body.clientId)) {
    return NextResponse.json({error: "Invalid session"}, {status: 400});
  }
  const {jobId} = await params;
  const active = touchGuestClient(jobId, guestSessionId(request), body.clientId);
  return new NextResponse(null, {status: active ? 204 : 404, headers: {"Cache-Control": "private, no-store"}});
}
