import type {ToolAction} from "@/content/tools/actions";

export type WorkflowRule = {
  id: string; name: string; enabled: boolean; tool: ToolAction | null;
  maxBytes: number | null; recipientEmail: string; createdAt: string;
  updatedAt?: string | null; archivedAt?: string | null;
  managementAvailable?: boolean;
};
export type WorkflowRun = {
  id: string; workflowId: string; workflowName: string; documentId: string;
  documentName: string; versionId: string; status: "running" | "succeeded" | "failed" | "skipped";
  reason: "approval_requested" | "conditions_not_met" | "recipient_unavailable" | "conflict" | "unavailable" | null;
  approvalId: string | null; createdAt: string; finishedAt: string | null;
  durable?: boolean;
};
