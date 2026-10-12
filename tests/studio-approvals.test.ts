import {afterEach, describe, expect, it, vi} from "vitest";
import {getCurrentUser} from "@/lib/auth/server";
import {createJob} from "@/lib/jobs";
import {createTemporaryFile, saveTemporaryFile} from "@/lib/storage/local";
import * as documents from "@/lib/workspace/documents";
import {createApproval, decideApproval, findApproval, listApprovals} from "@/lib/workspace/approvals";
import {listWorkspaceActivity} from "@/lib/workspace/activity";
import {GET as list, POST as requestApproval} from "@/app/api/studio/approvals/route";
import {GET as detail, PATCH as decide} from "@/app/api/studio/approvals/[approvalId]/route";
import {GET as file} from "@/app/api/studio/approvals/[approvalId]/file/route";
import {GET as privatePreview} from "@/app/api/studio/documents/[documentId]/preview/route";
import {fixtureBytes, pollJob} from "./helpers";

vi.mock("@/lib/auth/server", () => ({getCurrentUser: vi.fn()}));
const cleanup: {id: string; owner: string}[] = [];
afterEach(async () => {
  vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks();
  for (const item of cleanup.splice(0)) await documents.deleteWorkspaceDocument(item.id, item.owner);
});

function req(body?: unknown, method?: string, origin = "http://localhost") {
  return new Request("http://localhost/api/studio/approvals", {method: method ?? (body === undefined ? "GET" : "POST"), headers: {origin, "content-type": "application/json", cookie: `foliant_guest_session=${crypto.randomUUID()}`}, body: body === undefined ? undefined : JSON.stringify(body)});
}
function params(id: string) {return {params: Promise.resolve({approvalId: id})};}
async function job(degrees: 90 | 180 = 90) {
  const session = crypto.randomUUID();
  const bytes = fixtureBytes("light.pdf");
  const upload = createTemporaryFile({fileName: "review.pdf", fileSize: bytes.length, mimeType: "application/pdf", tool: "rotate_pdf", maxSize: 10000000, guestSessionId: session});
  await saveTemporaryFile(upload.id, new Uint8Array(bytes).buffer);
  const processed = createJob({tool: "rotate_pdf", fileIds: [upload.id], options: {rotateDegrees: degrees}, guestSessionId: session});
  await pollJob(processed.id);
  return processed;
}
async function setup() {
  const owner = crypto.randomUUID(); const reviewer = crypto.randomUUID(); const outsider = crypto.randomUUID();
  const document = (await documents.saveJobResultToWorkspace((await job()).id, owner))!;
  cleanup.push({id: document.id, owner});
  const version = (await documents.listWorkspaceDocumentVersions(document.id, owner))[0];
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co"); vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
  const lookup = vi.fn().mockImplementation(async () => new Response(JSON.stringify(reviewer), {status: 200}));
  vi.stubGlobal("fetch", lookup);
  const input = {userId: owner, email: "owner@example.test", documentId: document.id, versionId: version.id, recipientEmail: "reviewer@example.test"};
  return {owner, reviewer, outsider, document, version, input, lookup};
}
function user(id: string, email = "owner@example.test") {vi.mocked(getCurrentUser).mockResolvedValue({id, email});}

describe("Studio approval permissions and pinned versions", () => {
  it("reuses a local workflow approval id after a decision without duplicating activity",async()=>{
    const s=await setup();
    const requestId=crypto.randomUUID();
    const first=await createApproval({...s.input,requestId});
    await decideApproval(first.id,s.reviewer,"approved");
    const second=await createApproval({...s.input,requestId});
    expect(second.id).toBe(first.id);expect(second.status).toBe("approved");
    expect(await listApprovals(s.owner,s.document.id)).toHaveLength(1);
    expect((await listWorkspaceActivity(s.owner,s.document.id)).filter(item=>item.action==="approval_requested")).toHaveLength(1);
  });
  it("requires a verified account and same-origin mutations; validates bounded input", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect((await list(req())).status).toBe(401);
    expect((await requestApproval(req({}))).status).toBe(401);
    expect((await decide(req({decision: "approved"}, "PATCH"), params(crypto.randomUUID()))).status).toBe(401);
    expect((await file(req(), params(crypto.randomUUID()))).status).toBe(401);
    expect((await requestApproval(req({}, "POST", "https://other.test"))).status).toBe(403);
    expect((await decide(req({}, "PATCH", "https://other.test"), params(crypto.randomUUID()))).status).toBe(403);
    user(crypto.randomUUID());
    expect((await requestApproval(req({documentId: "../private", versionId: "x", recipientEmail: "x@example.test"}))).status).toBe(400);
    expect((await requestApproval(req({documentId: "doc", versionId: "version", recipientEmail: "not-an-email"}))).status).toBe(400);
    expect((await requestApproval(req({documentId: "doc", versionId: "version", recipientEmail: "x@example.test", note: "a".repeat(2001)}))).status).toBe(400);
    expect((await requestApproval(req({note: "a".repeat(15000)}))).status).toBe(413);
    expect((await requestApproval(req(null))).status).toBe(400);
    expect((await decide(req({decision: "pending"}, "PATCH"), params(crypto.randomUUID()))).status).toBe(400);
  });

  it("ignores forged identities and restricts list/detail/files to owner and assigned reviewer", async () => {
    const s = await setup();
    user(s.owner);
    const response = await requestApproval(req({...s.input, userId: s.outsider, reviewerId: s.outsider, recipientEmail: "REVIEWER@example.test", note: "Read version 1"}));
    expect(response.status).toBe(201);
    const created = (await response.json()).approval;
    expect(created.role).toBe("owner"); expect(created.ownerId).toBeUndefined(); expect(created.reviewerId).toBeUndefined();
    const record = (await findApproval(created.id, s.owner))!;
    expect(record.ownerId).toBe(s.owner); expect(record.reviewerId).toBe(s.reviewer);
    expect(s.lookup.mock.calls[0][0]).toContain("rpc/resolve_workspace_approver");
    expect(JSON.parse(s.lookup.mock.calls[0][1].body)).toEqual({p_email: "reviewer@example.test"});
    user(s.outsider);
    expect((await (await list(req())).json()).approvals).toEqual([]);
    expect((await detail(req(), params(record.id))).status).toBe(404);
    expect((await file(req(), params(record.id))).status).toBe(404);
    expect((await decide(req({decision: "approved"}, "PATCH"), params(record.id))).status).toBe(404);
    user(s.reviewer, "reviewer@example.test");
    expect((await (await detail(req(), params(record.id))).json()).approval.role).toBe("reviewer");
    expect((await file(req(), params(record.id))).status).toBe(200);
    expect((await privatePreview(req(), {params: Promise.resolve({documentId: s.document.id})})).status).toBe(404);
    expect((await decide(req({decision: "canceled"}, "PATCH"), params(record.id))).status).toBe(404);
    user(s.owner);
    expect((await decide(req({decision: "approved"}, "PATCH"), params(record.id))).status).toBe(404);
  });

  it("reviews the immutable saved version rather than later edits or restorations", async () => {
    const s = await setup();
    const approval = await createApproval(s.input);
    user(s.reviewer);
    const original = Buffer.from(await (await file(req(), params(approval.id))).arrayBuffer());
    const nextJob = await job(180);
    await documents.appendJobResultToWorkspaceDocument({documentId: s.document.id, jobId: nextJob.id, userId: s.owner});
    const current = (await documents.readWorkspaceDocumentFile(s.document.id, s.owner))!;
    expect(current.bytes.equals(original)).toBe(false);
    expect(Buffer.from(await (await file(req(), params(approval.id))).arrayBuffer()).equals(original)).toBe(true);
    expect((await findApproval(approval.id, s.reviewer))?.versionId).toBe(s.version.id);
    await documents.restoreWorkspaceDocumentVersion({documentId: s.document.id, versionId: s.version.id, userId: s.owner});
    expect(Buffer.from(await (await file(req(), params(approval.id))).arrayBuffer()).equals(original)).toBe(true);
    const decision = await decide(req({decision: "approved", comment: "Version 1 verified"}, "PATCH"), params(approval.id));
    expect(decision.status).toBe(200);
    expect((await decision.json()).approval).toMatchObject({status: "approved", versionNumber: 1, comment: "Version 1 verified"});
    const activity = await listWorkspaceActivity(s.owner, s.document.id);
    expect(activity.filter(event => event.action.startsWith("approval_")).map(event => event.action)).toEqual(["approval_approved", "approval_requested"]);
  });

  it("allows only one concurrent pending request and one terminal decision", async () => {
    const s = await setup();
    const requests = await Promise.allSettled([createApproval(s.input), createApproval(s.input)]);
    expect(requests.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(requests.filter(result => result.status === "rejected")).toHaveLength(1);
    const record = (await listApprovals(s.owner, s.document.id))[0];
    user(s.reviewer);
    const responses = await Promise.all([decide(req({decision: "approved"}, "PATCH"), params(record.id)), decide(req({decision: "rejected"}, "PATCH"), params(record.id))]);
    expect(responses.map(response => response.status).sort()).toEqual([200, 409]);
    expect((await listWorkspaceActivity(s.owner, s.document.id)).filter(event => event.action === "approval_approved" || event.action === "approval_rejected")).toHaveLength(1);
    await expect(decideApproval(record.id, s.reviewer, "rejected")).rejects.toMatchObject({status: 409});
  });

  it("revokes file access on cancellation and retains history after source deletion", async () => {
    const s = await setup();
    const record = await createApproval(s.input);
    user(s.owner);
    expect((await decide(req({decision: "canceled", comment: "Superseded"}, "PATCH"), params(record.id))).status).toBe(200);
    user(s.reviewer);
    expect((await file(req(), params(record.id))).status).toBe(404);
    expect((await decide(req({decision: "approved"}, "PATCH"), params(record.id))).status).toBe(409);
    const pending = await createApproval(s.input);
    await documents.deleteWorkspaceDocument(s.document.id, s.owner);
    expect((await detail(req(), params(pending.id))).status).toBe(200);
    expect((await file(req(), params(pending.id))).status).toBe(404);
    expect((await decide(req({decision: "approved"}, "PATCH"), params(pending.id))).status).toBe(404);
    expect((await findApproval(record.id, s.owner))?.status).toBe("canceled");
  });

  it("rejects unknown/self recipients and unauthorised source versions without leaking file data", async () => {
    const s = await setup();
    await expect(createApproval({...s.input, recipientEmail: "owner@example.test"})).rejects.toMatchObject({code: "recipient_unavailable"});
    s.lookup.mockImplementation(async () => new Response("null"));
    await expect(createApproval(s.input)).rejects.toMatchObject({code: "recipient_unavailable"});
    await expect(createApproval({...s.input, userId: s.outsider})).rejects.toMatchObject({code: "not_found"});
    await expect(createApproval({...s.input, versionId: "../outside"})).rejects.toMatchObject({code: "invalid_request"});
  });

  it("scopes Supabase queries and atomically compares pending status before recording a decision", async () => {
    const s = await setup();
    const row = {id: crypto.randomUUID(), owner_id: s.owner, reviewer_id: s.reviewer, owner_email: "owner@example.test", reviewer_email: "reviewer@example.test", document_id: s.document.id, document_name: "review.pdf", version_id: s.version.id, version_number: 1, status: "pending", note: "", comment: "", created_at: new Date().toISOString(), decided_at: null};
    vi.stubEnv("WORKSPACE_STORAGE_DRIVER", "supabase");
    vi.spyOn(documents, "getWorkspaceDocumentVersion").mockResolvedValue(s.version);
    const fetch = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url.includes("workspace_activity")) return new Response(null, {status: 201});
      if (init?.method === "PATCH") return new Response(JSON.stringify([{...row, ...JSON.parse(init.body as string)}]));
      return new Response(JSON.stringify([row]));
    });
    vi.stubGlobal("fetch", fetch);
    await listApprovals(s.reviewer);
    expect(fetch.mock.calls[0][0]).toContain(`or=(owner_id.eq.${s.reviewer},reviewer_id.eq.${s.reviewer})`);
    const decided = await decideApproval(row.id, s.reviewer, "approved", "Reviewed");
    expect(decided.status).toBe("approved");
    const patch = fetch.mock.calls.find(call => call[1]?.method === "PATCH")!;
    expect(patch[0]).toContain(`status=eq.pending&reviewer_id=eq.${s.reviewer}`);
    expect(patch[1]?.headers).toMatchObject({Prefer: "return=representation"});
    fetch.mockImplementation(async (url: string, init?: RequestInit) => new Response(JSON.stringify(init?.method === "PATCH" ? [] : [row])));
    await expect(decideApproval(row.id, s.reviewer, "rejected")).rejects.toMatchObject({code: "conflict"});
    fetch.mockResolvedValue(new Response(null, {status: 404}));
    await expect(listApprovals(s.owner)).rejects.toThrow("Approval storage unavailable");
  });
});
