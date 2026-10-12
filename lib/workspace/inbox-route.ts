import {NextResponse} from "next/server";
import {getCurrentUser} from "@/lib/auth/server";
import {isSameOrigin} from "@/lib/auth/config";
import {limitRequest} from "@/lib/validation/rate-limit";
import {AppError} from "@/lib/validation/errors";
import {InboxError} from "./inbox";

export const inboxHeaders = {"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
export function inboxJson(value:unknown,status=200) {
  return NextResponse.json(value,{status,headers:inboxHeaders});
}
export async function inboxRoute(request:Request,mutating:boolean,action:(userId:string)=>Promise<Response>) {
  if (mutating && !isSameOrigin(request)) return inboxJson({code:"invalid_origin"},403);
  try {
    const user = await getCurrentUser(request);
    if (!user) return inboxJson({code:"sign_in_required"},401);
    if (mutating) {
      const limited = limitRequest(request,"inbox",user.id);
      if (limited) return limited;
    }
    return await action(user.id);
  } catch (error) {
    if (error instanceof InboxError) return inboxJson({code:error.code},error.status);
    if (error instanceof AppError && error.status===413) return inboxJson({code:"file_too_large"},413);
    if (error instanceof SyntaxError || error instanceof URIError) return inboxJson({code:"invalid_request"},400);
    return inboxJson({code:"inbox_unavailable"},503);
  }
}
