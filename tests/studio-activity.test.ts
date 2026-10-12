import {afterEach, describe, expect, it, vi} from "vitest";
import {getCurrentUser} from "@/lib/auth/server";
import {createJob, listGuestActivity, publicJob} from "@/lib/jobs";
import {createTemporaryFile, saveTemporaryFile} from "@/lib/storage/local";
import {appendJobResultToWorkspaceDocument, deleteWorkspaceDocument, listWorkspaceDocumentVersions, restoreWorkspaceDocumentVersion, saveJobResultToWorkspace} from "@/lib/workspace/documents";
import {appendWorkspaceActivities, listWorkspaceActivity, recordWorkspaceActivity} from "@/lib/workspace/activity";
import {GET as documentActivity} from "@/app/api/studio/documents/[documentId]/activity/route";
import {GET as recentActivity} from "@/app/api/studio/activity/route";
import {GET as jobDownload} from "@/app/api/jobs/[jobId]/download/route";
import {GET as documentDownload} from "@/app/api/studio/documents/[documentId]/download/route";
import {POST as processDocument} from "@/app/api/jobs/route";
import {fixtureBytes, pollJob} from "./helpers";

vi.mock("@/lib/auth/server", () => ({getCurrentUser: vi.fn()}));
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

function request(session: string) {
  return new Request("http://localhost/api", {headers: {cookie: `foliant_guest_session=${session}`}});
}
async function processFile(session: string, bytes = fixtureBytes("light.pdf")) {
  const file = createTemporaryFile({fileName: "activity.pdf", fileSize: bytes.length, mimeType: "application/pdf", tool: "rotate_pdf", maxSize: 10000000, guestSessionId: session});
  await saveTemporaryFile(file.id, new Uint8Array(bytes).buffer);
  const job = createJob({tool: "rotate_pdf", fileIds: [file.id], options: {rotateDegrees: 90}, guestSessionId: session});
  await pollJob(job.id);
  return job;
}

describe("real Studio activity", () => {
  it("records guest processing and successful download requests without leaking the session", async () => {
    const session = crypto.randomUUID();
    const job = await processFile(session);
    const params = {params: Promise.resolve({documentId: job.id})};
    const events = listGuestActivity(job.id, session);
    expect(events.map(event => event.action)).toEqual(expect.arrayContaining(["imported", "job_created", "processing_completed"]));
    expect(events.map(event => event.action)).toEqual(["processing_completed", "job_created", "imported"]);
    expect(listGuestActivity(job.id, "other")).toEqual([]);
    expect((await documentActivity(request("other"), params)).status).toBe(404);
    expect((await documentActivity(request(session), params)).status).toBe(200);
    expect((await jobDownload(request("other"), {params: Promise.resolve({jobId: job.id})})).status).toBe(404);
    expect(listGuestActivity(job.id, session).filter(event => event.action === "download_requested")).toHaveLength(0);
    expect((await jobDownload(request(session), {params: Promise.resolve({jobId: job.id})})).status).toBe(200);
    expect(listGuestActivity(job.id, session).filter(event => event.action === "download_requested")).toHaveLength(1);
    expect(JSON.stringify(publicJob(job))).not.toContain(session);
    expect(JSON.stringify(events)).not.toContain("activity.pdf");
  });

  it("records processing failure rather than a false completion", async () => {
    const session = crypto.randomUUID();
    const job = await processFile(session, Buffer.from("%PDF-1.7\ninvalid PDF body"));
    const actions = listGuestActivity(job.id, session).map(event => event.action);
    expect(actions).toContain("processing_failed");
    expect(actions).not.toContain("processing_completed");
  });

  it("persists save, version, restore, download and deletion activity under the owner", async () => {
    const owner = crypto.randomUUID();
    const outsider = crypto.randomUUID();
    const session = crypto.randomUUID();
    const job = await processFile(session);
    const document = (await saveJobResultToWorkspace(job.id, owner))!;
    try {
      const updated = (await appendJobResultToWorkspaceDocument({documentId: document.id, jobId: job.id, userId: owner}))!;
      expect(updated.version.versionNumber).toBe(2);
      const versions = await listWorkspaceDocumentVersions(document.id, owner);
      await restoreWorkspaceDocumentVersion({documentId: document.id, versionId: versions[0].id, userId: owner});
      const params = {params: Promise.resolve({documentId: document.id})};
      vi.mocked(getCurrentUser).mockResolvedValue({id: outsider, email: "other@example.test"});
      expect((await documentActivity(request(session), params)).status).toBe(404);
      expect((await (await recentActivity(request(session))).json()).events).toEqual([]);
      vi.mocked(getCurrentUser).mockResolvedValue({id: owner, email: "owner@example.test"});
      const processing = await processDocument(new Request("http://localhost/api/jobs", {
        method: "POST", headers: {origin: "http://localhost", cookie: `foliant_guest_session=${session}`, "content-type": "application/json"},
        body: JSON.stringify({workspaceDocumentId: document.id, userId: outsider, tool: "rotate_pdf", options: {rotateDegrees: 90}})
      }));
      expect(processing.status).toBe(200);
      const ownedJob = await processing.json();
      expect(ownedJob.workspaceUserId).toBeUndefined();
      await pollJob(ownedJob.id);
      const processingEvents = (await listWorkspaceActivity(owner, document.id)).filter(event => event.jobId === ownedJob.id);
      expect(processingEvents.map(event => event.action)).toEqual(expect.arrayContaining(["job_created", "processing_completed"]));
      expect(processingEvents.map(event => event.action)).not.toContain("imported");
      expect((await documentDownload(request(session), params)).status).toBe(200);
      const events = await listWorkspaceActivity(owner, document.id);
      expect(events.map(event => event.action)).toEqual(expect.arrayContaining(["saved", "modified", "restored", "download_requested"]));
      expect(events.find(event => event.action === "modified")?.versionNumber).toBe(2);
      expect(events.find(event => event.action === "restored")?.versionNumber).toBe(3);
      expect(await listWorkspaceActivity(outsider, document.id)).toEqual([]);
      expect((await documentActivity(request(session), params)).status).toBe(200);
      expect(await deleteWorkspaceDocument(document.id, outsider)).toBe(false);
      expect(await deleteWorkspaceDocument(document.id, owner)).toBe(true);
      expect((await listWorkspaceActivity(owner, document.id)).some(event => event.action === "deleted")).toBe(true);
      expect((await documentActivity(request(session), params)).status).toBe(404);
      const recent = await (await recentActivity(request(session))).json();
      expect(recent.events.some((event: {action: string}) => event.action === "deleted")).toBe(true);
      expect(recent.events.every((event: {documentName?: string}) => event.documentName === undefined)).toBe(true);
      vi.mocked(getCurrentUser).mockResolvedValue(null);
      expect((await recentActivity(request(session))).status).toBe(401);
    } finally { await deleteWorkspaceDocument(document.id, owner); }
  });

  it("rejects unsafe identifiers and bounds history reads", async () => {
    expect(await listWorkspaceActivity("../other")).toEqual([]);
    await expect(appendWorkspaceActivities("../other", "doc_safe", [{action: "saved"}])).rejects.toThrow();
    const owner = crypto.randomUUID();
    await appendWorkspaceActivities(owner, "doc_limit", [{action: "saved"}, {action: "modified"}]);
    expect(await listWorkspaceActivity(owner, "doc_limit", 1)).toHaveLength(1);
    expect((await listWorkspaceActivity(owner, "doc_limit"))[0].action).toBe("modified");
  });

  it("uses scoped Supabase storage, batches writes and exposes unavailable reads", async () => {
    vi.stubEnv("WORKSPACE_STORAGE_DRIVER", "supabase");
    vi.stubEnv("SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("SUPABASE_SECRET_KEY", "test-key");
    const fetch = vi.fn().mockResolvedValue(new Response(null, {status: 201}));
    vi.stubGlobal("fetch", fetch);
    await appendWorkspaceActivities("owner", "doc_example", [{action: "saved"}, {action: "modified"}]);
    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(payload).toHaveLength(2);
    expect(payload.every((row: {user_id: string}) => row.user_id === "owner")).toBe(true);
    fetch.mockResolvedValue(new Response("[]", {status: 200}));
    await listWorkspaceActivity("owner", "doc_example");
    expect(fetch.mock.calls[1][0]).toContain("user_id=eq.owner&document_id=eq.doc_example");
    fetch.mockResolvedValue(new Response(null, {status: 404}));
    await expect(listWorkspaceActivity("owner")).rejects.toThrow("Activity storage unavailable");
    const logs = vi.spyOn(console, "info").mockImplementation(() => {});
    await expect(recordWorkspaceActivity("owner", "doc_example", {action: "saved"})).resolves.toBeUndefined();
    expect(logs).toHaveBeenCalledWith(expect.stringContaining('"event":"activity_failed"'));
    expect(logs.mock.calls.flat().join("")).not.toContain("test-key");
  });
});
