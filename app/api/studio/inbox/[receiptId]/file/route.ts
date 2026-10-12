import {readInboxFile,InboxError} from "@/lib/workspace/inbox";
import {inboxRoute,inboxHeaders} from "@/lib/workspace/inbox-route";
import {workspaceFileDisposition} from "@/lib/workspace/file-disposition";
type Props = {params:Promise<{receiptId:string}>};
export async function GET(request:Request,{params}:Props) {
  return inboxRoute(request,false,async userId=>{
    const {receipt,bytes} = await readInboxFile(userId,(await params).receiptId);
    const inline = new URL(request.url).searchParams.get("inline")==="1";
    if (inline && receipt.isProtected) throw new InboxError("pdf_password_required",409);
    return new Response(bytes,{headers:{...inboxHeaders,"Content-Type":"application/pdf",
      "Content-Disposition":workspaceFileDisposition(receipt.name,inline)}});
  });
}
