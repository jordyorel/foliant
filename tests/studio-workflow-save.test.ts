import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {getCurrentUser} from "@/lib/auth/server";
import {saveJobResultToWorkspace, appendJobResultToWorkspaceDocument} from "@/lib/workspace/documents";
import {enqueueDocumentWorkflows} from "@/lib/workspace/workflows";
import {POST} from "@/app/api/studio/documents/route";

vi.mock("@/lib/auth/server", () => ({getCurrentUser: vi.fn()}));
vi.mock("@/lib/jobs", () => ({canAccessGuestJob: vi.fn(() => true), getJob: vi.fn()}));
vi.mock("@/lib/workspace/documents", () => ({saveJobResultToWorkspace: vi.fn(), appendJobResultToWorkspaceDocument: vi.fn()}));
vi.mock("@/lib/workspace/workflows", () => ({enqueueDocumentWorkflows: vi.fn(),processQueuedWorkflows:vi.fn()}));
vi.mock("next/server",async original => ({...await original<typeof import("next/server")>(),after:vi.fn()}));
function request(documentId?: string) {
  return new Request("http://localhost/api/studio/documents", {method: "POST", headers: {origin: "http://localhost", "content-type": "application/json"}, body: JSON.stringify({jobId: "job_test", ...(documentId ? {documentId} : {})})});
}
beforeEach(() => {
  vi.mocked(getCurrentUser).mockResolvedValue({id: "owner", email: "owner@example.test"});
  vi.mocked(saveJobResultToWorkspace).mockResolvedValue({id: "doc_test"} as Awaited<ReturnType<typeof saveJobResultToWorkspace>>);
  vi.mocked(appendJobResultToWorkspaceDocument).mockResolvedValue({document: {id: "doc_test"}, version: {versionNumber: 2}} as Awaited<ReturnType<typeof appendJobResultToWorkspaceDocument>>);
  vi.mocked(enqueueDocumentWorkflows).mockResolvedValue();
});
afterEach(() => vi.resetAllMocks());
describe("Workflow save hook", () => {
  it("does not enqueue twice when the database saved and queued atomically",async()=>{
    vi.mocked(saveJobResultToWorkspace).mockResolvedValue({id:"doc_test",workflowsQueued:true} as Awaited<ReturnType<typeof saveJobResultToWorkspace>>);
    expect(await (await POST(request())).json()).toMatchObject({workflows:"queued"});
    expect(enqueueDocumentWorkflows).not.toHaveBeenCalled();
  });
  it("executes only on initial document saves, never on version updates", async () => {
    expect(await (await POST(request())).json()).toMatchObject({id: "doc_test", version: 1, workflows: "queued"});
    expect(enqueueDocumentWorkflows).toHaveBeenCalledWith("owner", "owner@example.test", "doc_test");
    vi.mocked(enqueueDocumentWorkflows).mockClear();
    expect(await (await POST(request("doc_test"))).json()).toMatchObject({version: 2, workflows: "not_triggered"});
    expect(enqueueDocumentWorkflows).not.toHaveBeenCalled();
  });
  it("preserves a successful document save when automation storage is unavailable", async () => {
    vi.mocked(enqueueDocumentWorkflows).mockRejectedValue(new Error("storage unavailable"));
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({id: "doc_test", workflows: "unavailable", resultUrl: "/api/studio/documents/doc_test/download"});
  });
  it("does not run for guests or unsaved results", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect((await POST(request())).status).toBe(401);
    vi.mocked(getCurrentUser).mockResolvedValue({id: "owner", email: "owner@example.test"});
    vi.mocked(saveJobResultToWorkspace).mockResolvedValue(null);
    expect((await POST(request())).status).toBe(404);
    expect(enqueueDocumentWorkflows).not.toHaveBeenCalled();
  });
});
