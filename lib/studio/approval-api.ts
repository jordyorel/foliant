import {NextResponse} from "next/server";
import {ApprovalError} from "@/lib/workspace/approvals";
import {AppError} from "@/lib/validation/errors";
import {readLimitedJson} from "@/lib/validation/body";

export const approvalHeaders = {"Cache-Control": "private, no-store"};
export function approvalJson(body: unknown, status = 200) {
  return NextResponse.json(body, {status, headers: approvalHeaders});
}
export function approvalFailure(error: unknown) {
  if (error instanceof ApprovalError) return approvalJson({error: error.code, code: error.code}, error.status);
  if (error instanceof AppError) return approvalJson({error: "Invalid request", code: "invalid_request"}, error.status);
  if (error instanceof SyntaxError) return approvalJson({error: "Invalid request", code: "invalid_request"}, 400);
  return approvalJson({error: "Approvals unavailable", code: "unavailable"}, 503);
}
export async function approvalBody(request: Request): Promise<Record<string, unknown>> {
  const value = await readLimitedJson(request, 12 * 1024);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApprovalError("invalid_request", 400);
  return value;
}
