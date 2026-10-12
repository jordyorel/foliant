import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {rm,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {storageRoot} from "@/lib/storage/root";
import {createWorkflow,enqueueDocumentWorkflows,processQueuedWorkflows,listWorkflowRuns,archiveWorkflow,updateWorkflow,setWorkflowEnabled} from "@/lib/workspace/workflows";
import {findApproval,createApproval} from "@/lib/workspace/approvals";
import {findWorkspaceDocument,listWorkspaceDocumentVersions} from "@/lib/workspace/documents";
import {POST} from "@/app/api/maintenance/workflows/route";

vi.mock("@/lib/workspace/documents",()=>({findWorkspaceDocument:vi.fn(),listWorkspaceDocumentVersions:vi.fn()}));
vi.mock("@/lib/workspace/approvals",async original=>({...await original<typeof import("@/lib/workspace/approvals")>(),findApproval:vi.fn(),createApproval:vi.fn()}));
const users:string[]=[];
const input={name:"Queue QA",tool:null,maxBytes:null,recipientEmail:"reviewer@example.test",consent:true};
async function setup() {
  const userId=crypto.randomUUID(); users.push(userId);
  const rule=await createWorkflow(userId,"owner@example.test",input);
  const now=new Date(Date.now()+1000).toISOString();
  vi.mocked(findWorkspaceDocument).mockResolvedValue({id:"doc",userId,name:"neutral.pdf",createdAt:now} as never);
  vi.mocked(listWorkspaceDocumentVersions).mockResolvedValue([{id:"v1",versionNumber:1,resultMimeType:"application/pdf",resultSize:2000,kindTool:"rotate_pdf"}] as never);
  return {userId,rule};
}
beforeEach(()=>{
  vi.stubEnv("WORKSPACE_STORAGE_DRIVER","local");vi.stubEnv("SUPABASE_URL","https://test.supabase.co");vi.stubEnv("SUPABASE_SECRET_KEY","test-secret");
  vi.stubGlobal("fetch",vi.fn(async()=>new Response(JSON.stringify("reviewer-id"))));
  vi.mocked(findApproval).mockResolvedValue(null);
  vi.mocked(createApproval).mockImplementation(async input=>({id:input.requestId}) as never);
});
afterEach(async()=>{
  for(const id of users.splice(0)) await rm(path.join(storageRoot,"workspace","workflows",id),{recursive:true,force:true});
  vi.unstubAllEnvs();vi.unstubAllGlobals();vi.resetAllMocks();
});
describe("Durable workflow queue",()=>{
  it("persists once without sharing during save and bounds concurrent workers",async()=>{
    const {userId}=await setup();
    await Promise.all([enqueueDocumentWorkflows(userId,"owner@example.test","doc"),enqueueDocumentWorkflows(userId,"owner@example.test","doc")]);
    expect(createApproval).not.toHaveBeenCalled();
    expect(await listWorkflowRuns(userId)).toEqual([expect.objectContaining({durable:true,status:"running",versionId:"v1"})]);
    await Promise.all([processQueuedWorkflows(userId),processQueuedWorkflows(userId)]);
    expect(createApproval).toHaveBeenCalledTimes(1);
    expect(await listWorkflowRuns(userId)).toEqual([expect.objectContaining({status:"succeeded"})]);
  });
  it("retains pending state after provider outage and resumes using the same approval id",async()=>{
    const {userId}=await setup();await enqueueDocumentWorkflows(userId,"owner@example.test","doc");
    const [run]=await listWorkflowRuns(userId);
    vi.mocked(createApproval).mockRejectedValueOnce(new Error("provider secret"));
    await expect(processQueuedWorkflows(userId)).rejects.toThrow();
    expect((await listWorkflowRuns(userId))[0].status).toBe("running");
    await processQueuedWorkflows(userId);
    expect(createApproval).toHaveBeenLastCalledWith(expect.objectContaining({requestId:run.id,versionId:"v1"}));
    expect(JSON.stringify(await listWorkflowRuns(userId))).not.toContain("provider secret");
  });
  it("recovers a crash after approval creation without sharing again even if already decided",async()=>{
    const {userId,rule}=await setup();await enqueueDocumentWorkflows(userId,"owner@example.test","doc");
    const [run]=await listWorkflowRuns(userId);
    await archiveWorkflow(userId,rule.id);
    vi.mocked(findApproval).mockResolvedValue({id:run.id,ownerId:userId,documentId:"doc",versionId:"v1",status:"approved"} as never);
    await processQueuedWorkflows(userId);
    expect(createApproval).not.toHaveBeenCalled();
    expect((await listWorkflowRuns(userId))[0]).toMatchObject({status:"succeeded",approvalId:run.id});
  });
  it.each(["pause","archive","edit"])("does not share a queued PDF after %s",async action=>{
    const {userId,rule}=await setup();await enqueueDocumentWorkflows(userId,"owner@example.test","doc");
    if(action==="pause") await setWorkflowEnabled(userId,rule.id,false);
    else if(action==="archive") await archiveWorkflow(userId,rule.id);
    else {await new Promise(resolve=>setTimeout(resolve,5));await updateWorkflow(userId,"owner@example.test",rule.id,{...input,name:"Edited",enabled:true});}
    await processQueuedWorkflows(userId);
    expect(createApproval).not.toHaveBeenCalled();
    expect((await listWorkflowRuns(userId))[0].status).toBe("skipped");
  });
  it("leaves legacy interrupted runs untouched and limits processing to the authenticated owner",async()=>{
    const {userId,rule}=await setup();await enqueueDocumentWorkflows(userId,"owner@example.test","doc");
    const file=path.join(storageRoot,"workspace","workflows",userId,"runs",`${rule.id}_doc.json`);
    const run=JSON.parse(await readFile(file,"utf8"));delete run.durable;await writeFile(file,JSON.stringify(run));
    expect(await processQueuedWorkflows(crypto.randomUUID())).toBe(0);
    expect(await processQueuedWorkflows(userId)).toBe(0);
    expect(createApproval).not.toHaveBeenCalled();
  });
  it("uses server-only RPCs and bounds batch size",async()=>{
    vi.stubEnv("WORKSPACE_STORAGE_DRIVER","supabase");vi.mocked(fetch).mockResolvedValue(new Response("0"));
    const userId=crypto.randomUUID();
    await enqueueDocumentWorkflows(userId,"owner@example.test","doc");
    await processQueuedWorkflows(userId,999);
    expect(vi.mocked(fetch).mock.calls[0][0]).toContain("rpc/enqueue_workspace_workflows");
    expect(JSON.parse(vi.mocked(fetch).mock.calls[1][1]!.body as string)).toEqual({p_user_id:userId,p_limit:10});
  });
  it("requires maintenance authentication and never leaks failed provider responses",async()=>{
    vi.stubEnv("MAINTENANCE_SECRET","queue-test-secret-at-least-32-characters");
    const request=(authorized=false)=>new Request("http://localhost/api/maintenance/workflows",{method:"POST",headers:authorized ? {authorization:`Bearer ${process.env.MAINTENANCE_SECRET}`} : {}});
    expect((await POST(request())).status).toBe(401);
    vi.stubEnv("WORKSPACE_STORAGE_DRIVER","supabase");vi.mocked(fetch).mockResolvedValue(new Response("0"));
    expect(await (await POST(request(true))).json()).toEqual({processed:0});
    vi.mocked(fetch).mockRejectedValue(new Error("provider secret"));
    const response=await POST(request(true));expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("provider secret");
  });
});
