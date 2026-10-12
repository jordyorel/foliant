import {getInboxReceipt,archiveInbox,InboxError} from "@/lib/workspace/inbox";
import {inboxRoute,inboxJson} from "@/lib/workspace/inbox-route";
import {readLimitedJson} from "@/lib/validation/body";
type Props = {params:Promise<{receiptId:string}>};
export async function GET(request:Request,{params}:Props) {
  return inboxRoute(request,false,async userId=>inboxJson(await getInboxReceipt(userId,(await params).receiptId)));
}
export async function PATCH(request:Request,{params}:Props) {
  return inboxRoute(request,true,async userId=>{
    const body = await readLimitedJson(request,1024);
    if (!body || typeof body.archive!=="boolean") throw new InboxError("invalid_request",400);
    return inboxJson(await archiveInbox(userId,(await params).receiptId,body.archive));
  });
}
