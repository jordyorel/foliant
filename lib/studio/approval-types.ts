export const approvalStatuses = ["pending", "approved", "rejected", "canceled"] as const;
export type ApprovalStatus = (typeof approvalStatuses)[number];
export type ApprovalDecision = Exclude<ApprovalStatus, "pending">;

export type ApprovalRecord = {
  id: string;
  ownerId: string;
  reviewerId: string;
  ownerEmail: string;
  reviewerEmail: string;
  documentId: string;
  documentName: string;
  versionId: string;
  versionNumber: number;
  status: ApprovalStatus;
  note: string;
  comment: string;
  createdAt: string;
  decidedAt: string | null;
};

export type StudioApproval = Omit<ApprovalRecord, "ownerId" | "reviewerId"> & {
  role: "owner" | "reviewer";
};

export function publicApproval(record: ApprovalRecord, userId: string): StudioApproval {
  const {ownerId, reviewerId, ...publicRecord} = record;
  return {...publicRecord, role: ownerId === userId ? "owner" : "reviewer"};
}
