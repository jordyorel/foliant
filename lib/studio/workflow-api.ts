import {approvalFailure, approvalJson} from "./approval-api";
import {WorkflowError} from "@/lib/workspace/workflows";

export function workflowFailure(error: unknown) {
  if (error instanceof WorkflowError) return approvalJson({code: error.code}, error.status);
  return approvalFailure(error);
}
