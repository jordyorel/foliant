export type InboxStatus = "received" | "accepted" | "archived";
export type InboxReceipt = {
  id: string;
  name: string;
  size: number;
  pageCount: number | null;
  isProtected: boolean;
  origin: "manual";
  status: InboxStatus;
  documentId: string | null;
  createdAt: string;
  acceptedAt: string | null;
  archivedAt: string | null;
};
export type InboxDetail = InboxReceipt & {
  events: {id: string; action: "received" | "accepted" | "archived" | "restored"; created_at: string}[];
};
export type InboxList = {receipts: InboxReceipt[]; total: number; offset: number};
