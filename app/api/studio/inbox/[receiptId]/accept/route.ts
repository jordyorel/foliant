import {after} from "next/server";
import {acceptInbox} from "@/lib/workspace/inbox";
import {inboxRoute,inboxJson} from "@/lib/workspace/inbox-route";
import {resumeUserWorkflows} from "@/lib/workspace/workflow-worker";
type Props = {params:Promise<{receiptId:string}>};
export async function POST(request:Request,{params}:Props) {
  return inboxRoute(request,true,async userId=>{
    const receipt = await acceptInbox(userId,(await params).receiptId);
    if (receipt.documentId) after(()=>resumeUserWorkflows(userId));
    return inboxJson(receipt);
  });
}
