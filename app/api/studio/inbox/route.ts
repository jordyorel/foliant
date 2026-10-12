import {listInbox,receiveInboxPdf,inboxMaxBytes,InboxError,type InboxStatus} from "@/lib/workspace/inbox";
import {inboxRoute,inboxJson} from "@/lib/workspace/inbox-route";
import {readLimitedBody} from "@/lib/validation/body";

export const dynamic = "force-dynamic";
export async function GET(request:Request) {
  return inboxRoute(request,false,async userId=>{
    const query = new URL(request.url).searchParams;
    return inboxJson(await listInbox(userId,(query.get("status")??"received") as InboxStatus,Number(query.get("offset")??0),query.get("search")??"",query.get("sort")??"newest"));
  });
}
// Binary upload is bounded while streaming; multipart parsing cannot allocate an unlimited body.
export async function POST(request:Request) {
  return inboxRoute(request,true,async userId=>{
    if (request.headers.get("content-type")?.split(";")[0].trim()!=="application/pdf") throw new InboxError("invalid_pdf",415);
    const name = decodeURIComponent(request.headers.get("x-file-name")??"");
    const idempotencyKey = request.headers.get("idempotency-key")??"";
    const bytes = new Uint8Array(await readLimitedBody(request,inboxMaxBytes));
    return inboxJson(await receiveInboxPdf(userId,idempotencyKey,name,bytes),201);
  });
}
