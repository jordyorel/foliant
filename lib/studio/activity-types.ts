import type {ToolAction} from "@/content/tools/actions";

export const activityActions = ["imported", "job_created", "processing_completed", "processing_failed", "download_requested", "saved", "modified", "restored", "deleted", "approval_requested", "approval_approved", "approval_rejected", "approval_canceled"] as const;
export type ActivityAction = typeof activityActions[number];
export type ActivityEvent = {
  id: string;
  action: ActivityAction;
  createdAt: string;
  documentId?: string;
  jobId?: string;
  tool?: ToolAction;
  versionNumber?: number;
  documentName?: string;
  sequence?: number;
};
