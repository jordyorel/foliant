import {logOperationalEvent} from "@/lib/operations/log";
import {processQueuedWorkflows} from "./workflows";

export async function resumeUserWorkflows(userId: string) {
  try {await processQueuedWorkflows(userId);}
  catch {logOperationalEvent("workflow_failed");}
}
