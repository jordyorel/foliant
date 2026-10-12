import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import path from "node:path";

vi.mock("@/lib/jobs", () => ({getJob: () => ({id: "job_atomic", status: "completed", tool: "rotate_pdf", fileIds: [], pageCount: 1}), listGuestActivity: () => []}));
vi.mock("@/lib/storage/local", () => ({getResultFile: () => ({path: path.resolve("tests/fixtures/light.pdf"), fileName: "neutral.pdf", mimeType: "application/pdf"}), getTemporaryFile: () => null}));
vi.mock("@/lib/workspace/activity", () => ({recordWorkspaceActivity: vi.fn(), recordWorkspaceActivities: vi.fn()}));

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("WORKSPACE_STORAGE_DRIVER", "supabase");
  vi.stubEnv("SUPABASE_URL", "https://workspace.example.test");
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-only-secret");
});
afterEach(() => {vi.unstubAllGlobals(); vi.unstubAllEnvs();});

describe("Atomic Supabase workspace save", () => {
  it("uploads the file and saves document, V1 and queue through one RPC", async () => {
    const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
      if (url.includes("/storage/")) return new Response("{}", {status: 200});
      const {p_document: row} = JSON.parse(String(init.body));
      return Response.json([row]);
    });
    vi.stubGlobal("fetch", fetchMock);
    const {saveJobResultToWorkspace} = await import("@/lib/workspace/documents");
    const saved = await saveJobResultToWorkspace("job_atomic", "owner");
    expect(saved).toMatchObject({userId: "owner", sourceJobId: "job_atomic", workflowsQueued: true});
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://workspace.example.test/rest/v1/rpc/save_workspace_document");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1].body))).toMatchObject({p_document: {user_id: "owner", source_job_id: "job_atomic"}});
  });

  it("does not report success when the transaction fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => new Response("{}", {status: url.includes("/storage/") ? 200 : 503})));
    const {saveJobResultToWorkspace} = await import("@/lib/workspace/documents");
    await expect(saveJobResultToWorkspace("job_atomic", "owner")).rejects.toThrow("503");
  });

  it("rejects an empty RPC result rather than claiming a saved document", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => Response.json(url.includes("/storage/") ? {} : [])));
    const {saveJobResultToWorkspace} = await import("@/lib/workspace/documents");
    await expect(saveJobResultToWorkspace("job_atomic", "owner")).rejects.toThrow("did not return a document");
  });
});
