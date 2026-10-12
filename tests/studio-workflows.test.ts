import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {rm} from "node:fs/promises";
import path from "node:path";
import {storageRoot} from "@/lib/storage/root";
import {getCurrentUser} from "@/lib/auth/server";
import {ApprovalError, createApproval} from "@/lib/workspace/approvals";
import {findWorkspaceDocument, listWorkspaceDocumentVersions} from "@/lib/workspace/documents";
import {archiveWorkflow, createWorkflow, findWorkflow, listWorkflows, listWorkflowRuns, runDocumentWorkflows, setWorkflowEnabled, updateWorkflow} from "@/lib/workspace/workflows";
import {GET, POST} from "@/app/api/studio/workflows/route";
import {PATCH} from "@/app/api/studio/workflows/[workflowId]/route";

vi.mock("@/lib/auth/server", () => ({getCurrentUser: vi.fn()}));
vi.mock("@/lib/workspace/documents", () => ({findWorkspaceDocument: vi.fn(), listWorkspaceDocumentVersions: vi.fn()}));
vi.mock("@/lib/workspace/approvals", async importOriginal => ({...await importOriginal<typeof import("@/lib/workspace/approvals")>(), createApproval: vi.fn()}));
const owners: string[] = [];
const input = {name: "PDF review", tool: null, maxBytes: null, recipientEmail: "reviewer@example.test", consent: true};
function owner() {const id = crypto.randomUUID(); owners.push(id); return id;}
function req(body?: unknown, method = body === undefined ? "GET" : "POST", origin = "http://localhost") {
  return new Request("http://localhost/api/studio/workflows", {method, headers: {origin, "content-type": "application/json"}, body: body === undefined ? undefined : JSON.stringify(body)});
}
function ctx(id: string) {return {params: Promise.resolve({workflowId: id})};}
function source(id: string, userId: string, overrides = {}) {
  const now = new Date(Date.now() + 1000).toISOString();
  vi.mocked(findWorkspaceDocument).mockResolvedValue({id, userId, name: "neutral.pdf", sourceJobId: "job", kindTool: "rotate_pdf", resultPath: "unused", resultFileName: "neutral.pdf", resultMimeType: "application/pdf", resultSize: 2000, createdAt: now, updatedAt: now});
  vi.mocked(listWorkspaceDocumentVersions).mockResolvedValue([{id: "v1", documentId: id, sourceJobId: "job", versionNumber: 1, kindTool: "rotate_pdf", resultPath: "unused", resultFileName: "neutral.pdf", resultMimeType: "application/pdf", resultSize: 2000, createdAt: now, ...overrides}]);
}
beforeEach(() => {
  vi.stubEnv("WORKSPACE_STORAGE_DRIVER", "local");
  vi.stubEnv("SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SECRET_KEY", "test-secret");
  vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(crypto.randomUUID()))));
  vi.mocked(createApproval).mockResolvedValue({id: crypto.randomUUID()} as Awaited<ReturnType<typeof createApproval>>);
});
afterEach(async () => {
  for (const id of owners.splice(0)) await rm(path.join(storageRoot, "workspace", "workflows", id), {recursive: true, force: true});
  vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.resetAllMocks();
});

describe("Studio workflow consent, scope and execution", () => {
  it("requires an account, same-origin mutation and explicit sharing consent", async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect((await GET(req())).status).toBe(401);
    expect((await POST(req(input))).status).toBe(401);
    expect((await POST(req(input, "POST", "https://outside.test"))).status).toBe(403);
    vi.mocked(getCurrentUser).mockResolvedValue({id: owner(), email: "owner@example.test"});
    for (const body of [{...input, consent: false}, {...input, tool: "fake"}, {...input, tool: "document_summarizer"}, {...input, tool: "pdf_to_word"}, {...input, maxBytes: -1}, {...input, name: "x".repeat(81)}, null]) expect((await POST(req(body))).status).toBe(400);
    expect((await POST(req({...input, name: "x".repeat(15000)}))).status).toBe(413);
  });

  it("isolates rules and requires renewed consent to resume", async () => {
    const id = owner(); const outsider = owner();
    const rule = await createWorkflow(id, "owner@example.test", input);
    expect(await listWorkflows(outsider)).toEqual([]);
    await expect(setWorkflowEnabled(outsider, rule.id, false)).rejects.toMatchObject({code: "not_found"});
    vi.mocked(getCurrentUser).mockResolvedValue({id, email: "owner@example.test"});
    expect((await PATCH(req({enabled: false}, "PATCH"), ctx(rule.id))).status).toBe(200);
    expect((await PATCH(req({enabled: true}, "PATCH"), ctx(rule.id))).status).toBe(400);
    expect((await PATCH(req({enabled: true, consent: true}, "PATCH"), ctx(rule.id))).status).toBe(200);
  });

  it("bounds concurrent rule creation to five without leaving a persistent lock", async () => {
    const id = owner();
    const results = await Promise.allSettled(Array.from({length: 7}, () => createWorkflow(id, "owner@example.test", input)));
    expect(results.filter(value => value.status === "fulfilled")).toHaveLength(5);
    expect(results.filter(value => value.status === "rejected")).toHaveLength(2);
    expect(await listWorkflows(id)).toHaveLength(5);
  });

  it("edits only owned rules with new consent, without rewriting historical runs", async () => {
    const id = owner(); const outsider = owner();
    const rule = await createWorkflow(id,"owner@example.test",input);
    source("original",id);
    await runDocumentWorkflows(id,"owner@example.test","original");
    vi.mocked(getCurrentUser).mockResolvedValue({id,email:"owner@example.test"});
    const changes = {...input,action:"update",enabled:true,name:"New review",tool:"rotate_pdf",maxBytes:5000};
    expect((await PATCH(req({...changes,consent:false},"PATCH"),ctx(rule.id))).status).toBe(400);
    expect((await PATCH(req(changes,"PATCH"),ctx(rule.id))).status).toBe(200);
    expect(await findWorkflow(id,rule.id)).toMatchObject({name:"New review",tool:"rotate_pdf",maxBytes:5000,enabled:true,createdAt:rule.createdAt,updatedAt:expect.any(String)});
    expect((await listWorkflowRuns(id))[0].workflowName).toBe(input.name);
    await expect(updateWorkflow(outsider,"other@example.test",rule.id,changes)).rejects.toMatchObject({code:"not_found"});
    await expect(updateWorkflow(id,"owner@example.test",rule.id,{...changes,recipientEmail:"owner@example.test"})).rejects.toMatchObject({code:"recipient_unavailable"});
    source("before-edit",id);
    const document = (await findWorkspaceDocument("before-edit",id))!;
    vi.mocked(findWorkspaceDocument).mockResolvedValue({...document,createdAt:rule.createdAt});
    await runDocumentWorkflows(id,"owner@example.test","before-edit");
    expect(createApproval).toHaveBeenCalledTimes(1);
  });

  it("archives without deleting history, frees a slot and cannot resume or edit an archived rule", async () => {
    const id = owner(); const outsider = owner();
    const rule = await createWorkflow(id,"owner@example.test",input);
    source("archived-document",id); await runDocumentWorkflows(id,"owner@example.test","archived-document");
    for (let count=0;count<4;count++) await createWorkflow(id,"owner@example.test",input);
    await expect(archiveWorkflow(outsider,rule.id)).rejects.toMatchObject({code:"not_found"});
    vi.mocked(getCurrentUser).mockResolvedValue({id,email:"owner@example.test"});
    expect((await PATCH(req({action:"archive"},"PATCH"),ctx(rule.id))).status).toBe(200);
    const archived = await archiveWorkflow(id,rule.id);
    expect(archived).toMatchObject({enabled:false,archivedAt:expect.any(String)});
    expect(await listWorkflows(id)).toHaveLength(4);
    expect(await listWorkflows(id,true)).toHaveLength(5);
    expect(await listWorkflowRuns(id)).toHaveLength(1);
    await createWorkflow(id,"owner@example.test",input);
    expect(await listWorkflows(id)).toHaveLength(5);
    await expect(setWorkflowEnabled(id,rule.id,true)).rejects.toMatchObject({code:"not_found"});
    await expect(updateWorkflow(id,"owner@example.test",rule.id,{...input,enabled:true})).rejects.toMatchObject({code:"not_found"});
    expect((await GET(new Request(`http://localhost/api/studio/workflows?workflowId=${rule.id}`))).status).toBe(200);
    vi.mocked(getCurrentUser).mockResolvedValue({id:outsider,email:"other@example.test"});
    expect((await GET(new Request(`http://localhost/api/studio/workflows?workflowId=${rule.id}`))).status).toBe(404);
  });

  it("does not run archived rules and protects edit/archive API mutations", async () => {
    const id = owner(); const rule = await createWorkflow(id,"owner@example.test",input);
    await archiveWorkflow(id,rule.id);
    await runDocumentWorkflows(id,"owner@example.test","new-file");
    expect(createApproval).not.toHaveBeenCalled();
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect((await PATCH(req({action:"archive"},"PATCH"),ctx(rule.id))).status).toBe(401);
    expect((await PATCH(req({action:"archive"},"PATCH","https://outside.test"),ctx(rule.id))).status).toBe(403);
    vi.mocked(getCurrentUser).mockResolvedValue({id,email:"owner@example.test"});
    expect((await PATCH(req({action:"delete"},"PATCH"),ctx(rule.id))).status).toBe(400);
  });

  it("rejects unknown and self recipients", async () => {
    const id = owner();
    await expect(createWorkflow(id, "owner@example.test", {...input, recipientEmail: "owner@example.test"})).rejects.toMatchObject({code: "recipient_unavailable"});
    vi.mocked(fetch).mockResolvedValue(new Response("null"));
    await expect(createWorkflow(id, "owner@example.test", input)).rejects.toMatchObject({code: "recipient_unavailable"});
  });

  it("claims one run under concurrency and shares only the initial saved version", async () => {
    const id = owner(); const documentId = crypto.randomUUID();
    const rule = await createWorkflow(id, "owner@example.test", input);
    source(documentId, id);
    await Promise.all([runDocumentWorkflows(id, "owner@example.test", documentId), runDocumentWorkflows(id, "owner@example.test", documentId)]);
    expect(createApproval).toHaveBeenCalledTimes(1);
    expect(createApproval).toHaveBeenCalledWith(expect.objectContaining({userId: id, documentId, versionId: "v1", recipientEmail: input.recipientEmail}));
    expect(await listWorkflowRuns(id)).toEqual([expect.objectContaining({workflowId: rule.id, status: "succeeded", reason: "approval_requested", versionId: "v1"})]);
    expect(await listWorkflowRuns(owner())).toEqual([]);
    await runDocumentWorkflows(id, "owner@example.test", documentId);
    expect(createApproval).toHaveBeenCalledTimes(1);
  });

  it("skips nonmatching files and does not execute paused rules or old documents", async () => {
    const id = owner();
    const rule = await createWorkflow(id, "owner@example.test", {...input, tool: "rotate_pdf", maxBytes: 1000});
    for (const overrides of [{}, {resultMimeType: "image/png"}, {kindTool: "merge_pdf"}]) {
      const documentId = crypto.randomUUID(); source(documentId, id, overrides);
      await runDocumentWorkflows(id, "owner@example.test", documentId);
    }
    expect(await listWorkflowRuns(id)).toHaveLength(3);
    expect((await listWorkflowRuns(id)).every(run => run.status === "skipped")).toBe(true);
    await setWorkflowEnabled(id, rule.id, false);
    await runDocumentWorkflows(id, "owner@example.test", crypto.randomUUID());
    expect(await listWorkflowRuns(id)).toHaveLength(3);
    await setWorkflowEnabled(id, rule.id, true);
    source("old", id);
    const document = (await findWorkspaceDocument("old", id))!;
    vi.mocked(findWorkspaceDocument).mockResolvedValue({...document, createdAt: "2020-01-01T00:00:00Z"});
    await runDocumentWorkflows(id, "owner@example.test", "old");
    expect(await listWorkflowRuns(id)).toHaveLength(3);
    expect(createApproval).not.toHaveBeenCalled();
  });

  it("records safe failure reasons without leaking provider errors or retrying sharing", async () => {
    const id = owner(); const documentId = crypto.randomUUID();
    await createWorkflow(id, "owner@example.test", input); source(documentId, id);
    vi.mocked(createApproval).mockRejectedValue(new ApprovalError("recipient_unavailable", 400));
    await runDocumentWorkflows(id, "owner@example.test", documentId);
    expect(await listWorkflowRuns(id)).toEqual([expect.objectContaining({status: "failed", reason: "recipient_unavailable", approvalId: null})]);
    source("second", id);
    vi.mocked(createApproval).mockRejectedValue(new Error("secret provider details"));
    await runDocumentWorkflows(id, "owner@example.test", "second");
    expect(JSON.stringify(await listWorkflowRuns(id))).not.toContain("secret provider details");
    expect((await listWorkflowRuns(id)).some(run => run.reason === "unavailable")).toBe(true);
  });

  it("scopes remote reads and mutations and claims remote runs atomically", async () => {
    const id = owner(); const documentId = crypto.randomUUID(); const ruleId = crypto.randomUUID();
    const row = {id: ruleId, user_id: id, name: "Review", enabled: true, tool: null, max_bytes: null, recipient_email: input.recipientEmail, created_at: "2020-01-01T00:00:00Z"};
    vi.stubEnv("WORKSPACE_STORAGE_DRIVER", "supabase");
    let claimed = false;
    const remoteFetch = vi.fn(async (url: string, init?: RequestInit) => {
      if (url.includes("workspace_workflow_runs?on_conflict")) {
        const result = claimed ? [] : [JSON.parse(init!.body as string)];
        claimed = true; return new Response(JSON.stringify(result));
      }
      if (url.includes("workspace_workflow_runs")) return new Response("[]");
      return new Response(JSON.stringify([row]));
    });
    vi.stubGlobal("fetch", remoteFetch);
    await listWorkflows(id); await listWorkflowRuns(id); await setWorkflowEnabled(id, ruleId, false);
    expect(remoteFetch.mock.calls[0][0]).toContain(`user_id=eq.${id}`);
    expect(remoteFetch.mock.calls[1][0]).toContain(`user_id=eq.${id}`);
    expect(remoteFetch.mock.calls[2][0]).toContain(`id=eq.${ruleId}&user_id=eq.${id}`);
    source(documentId, id);
    await runDocumentWorkflows(id, "owner@example.test", documentId);
    await runDocumentWorkflows(id, "owner@example.test", documentId);
    expect(createApproval).toHaveBeenCalledTimes(1);
    const claimCall = remoteFetch.mock.calls.find(call => call[0].includes("on_conflict"))!;
    expect(claimCall[1]?.headers).toMatchObject({Prefer: "resolution=ignore-duplicates,return=representation"});
    const finishCall = remoteFetch.mock.calls.find(call => call[0].includes("status=eq.running"))!;
    expect(finishCall[0]).toContain(`user_id=eq.${id}`);
    expect(JSON.parse(finishCall[1]!.body as string)).toMatchObject({status: "succeeded", reason: "approval_requested"});
  });

  it("keeps legacy Supabase rules usable until the management migration, without masking outages", async () => {
    const id = owner(); const ruleId=crypto.randomUUID();
    const row = {id:ruleId,user_id:id,name:"Legacy",enabled:false,tool:null,max_bytes:null,recipient_email:input.recipientEmail,created_at:"2020-01-01T00:00:00Z"};
    vi.stubEnv("WORKSPACE_STORAGE_DRIVER","supabase");
    const remoteFetch=vi.fn(async (url:string)=>new Response(JSON.stringify(url.includes("archived_at") ? {code:"42703"} : [row]),{status:url.includes("archived_at") ? 400 : 200}));
    vi.stubGlobal("fetch",remoteFetch);
    expect(await listWorkflows(id)).toEqual([expect.objectContaining({managementAvailable:false})]);
    expect(await setWorkflowEnabled(id,ruleId,false)).toMatchObject({id:ruleId});
    await expect(updateWorkflow(id,"owner@example.test",ruleId,{...input,enabled:false})).rejects.toThrow("migration required");
    expect(remoteFetch.mock.calls.every(call=>call[0].includes(`user_id=eq.${id}`))).toBe(true);
    remoteFetch.mockImplementation(async ()=>new Response(JSON.stringify({code:"XX000"}),{status:500}));
    await expect(listWorkflows(id)).rejects.toThrow("unavailable");
  });

  it("scopes remote editing and archiving to the owner and excludes archived rules from mutations", async () => {
    const id=owner();const ruleId=crypto.randomUUID();
    const row={id:ruleId,user_id:id,name:"Review",enabled:false,tool:null,max_bytes:null,recipient_email:input.recipientEmail,created_at:"2020-01-01T00:00:00Z",archived_at:null,updated_at:null};
    vi.stubEnv("WORKSPACE_STORAGE_DRIVER","supabase");
    const remoteFetch=vi.fn(async (url:string,init?:RequestInit)=>new Response(JSON.stringify(url.includes("resolve_workspace_approver") ? "recipient-id" : [{...row,...(init?.method==="PATCH" ? JSON.parse(init.body as string) : {})}])));
    vi.stubGlobal("fetch",remoteFetch);
    await updateWorkflow(id,"owner@example.test",ruleId,{...input,enabled:false,name:"Changed"});
    await archiveWorkflow(id,ruleId);
    const changes=remoteFetch.mock.calls.filter(call=>call[1]?.method==="PATCH");
    expect(changes).toHaveLength(2);
    for(const call of changes) expect(call[0]).toContain(`id=eq.${ruleId}&user_id=eq.${id}&archived_at=is.null`);
    expect(JSON.parse(changes[0][1]!.body as string)).toMatchObject({name:"Changed",enabled:false,updated_at:expect.any(String)});
    expect(JSON.parse(changes[1][1]!.body as string)).toMatchObject({enabled:false,archived_at:expect.any(String)});
  });
});
