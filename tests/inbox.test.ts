import {mkdtemp,readFile,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {afterEach,beforeEach,describe,expect,it,vi} from "vitest";
import {getCurrentUser} from "@/lib/auth/server";
import {GET,POST} from "@/app/api/studio/inbox/route";
import {PATCH} from "@/app/api/studio/inbox/[receiptId]/route";
import {GET as fileGET} from "@/app/api/studio/inbox/[receiptId]/file/route";
import {POST as acceptPOST} from "@/app/api/studio/inbox/[receiptId]/accept/route";
import {acceptInbox,receiveInboxPdf,validateInboxPdf} from "@/lib/workspace/inbox";
import {workspaceFileDisposition} from "@/lib/workspace/file-disposition";
import {protectPdf} from "@/processors/pdf/security";
import {isQpdfAvailable} from "./helpers";

vi.mock("@/lib/auth/server",()=>({getCurrentUser:vi.fn()}));
vi.mock("@/lib/workspace/workflow-worker",()=>({resumeUserWorkflows:vi.fn()}));
vi.mock("next/server",async original=>({...await original<typeof import("next/server")>(),after:vi.fn()}));
const owner = "00000000-0000-0000-0000-000000000001";
const other = "00000000-0000-0000-0000-000000000002";
const id = "22222222-2222-4222-8222-222222222222";
const params = {params:Promise.resolve({receiptId:id})};
let bytes:Uint8Array;
function row(status="received") {
  return {id,user_id:owner,request_id:id,name:"neutral.pdf",size:bytes.length,
    sha256:createHash("sha256").update(bytes).digest("hex"),page_count:1,protected_pdf:false,
    object_key:`inbox/${owner}/${id}.pdf`,origin:"manual",status,document_id:null,
    created_at:new Date().toISOString(),accepted_at:null,archived_at:null};
}
function upload(origin="http://localhost") {
  return new Request("http://localhost/api/studio/inbox",{method:"POST",headers:{origin,
    "Content-Type":"application/pdf","X-File-Name":"neutral.pdf","Idempotency-Key":id},body:Uint8Array.from(bytes)});
}
beforeEach(async()=>{
  bytes = new Uint8Array(await readFile("tests/fixtures/light.pdf"));
  vi.stubEnv("WORKSPACE_STORAGE_DRIVER","supabase");
  vi.stubEnv("SUPABASE_URL","https://inbox.example.test");
  vi.stubEnv("SUPABASE_SECRET_KEY","test-only-key");
  vi.mocked(getCurrentUser).mockResolvedValue({id:owner,email:"owner@example.test"});
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();vi.clearAllMocks();});

describe("Inbox PDF reception",()=>{
  it("validates a real PDF without changing its bytes",async()=>{
    expect(await validateInboxPdf(bytes,"formulaire.pdf")).toMatchObject({pageCount:1,isProtected:false,sha256:row().sha256});
  });
  it.skipIf(!isQpdfAvailable())("recognizes a protected PDF without decrypting or changing it",async()=>{
    const folder=await mkdtemp(join(tmpdir(),"foliant-inbox-qa-"));
    try {
      const file=join(folder,"protected.pdf");
      await protectPdf("tests/fixtures/light.pdf",file,{password:"test-only"});
      const protectedBytes=new Uint8Array(await readFile(file));
      expect(await validateInboxPdf(protectedBytes,"protected.pdf")).toMatchObject({isProtected:true,
        sha256:createHash("sha256").update(protectedBytes).digest("hex")});
    } finally {await rm(folder,{recursive:true,force:true});}
  });
  it.each(["../neutral.pdf","invalid\n.pdf","wrong.txt"])("rejects unsafe names %s",async name=>{
    await expect(validateInboxPdf(bytes,name)).rejects.toMatchObject({status:400});
  });
  it("rejects corrupt content and excessive size",async()=>{
    await expect(validateInboxPdf(new TextEncoder().encode("not PDF"),"neutral.pdf")).rejects.toMatchObject({status:415});
    await expect(validateInboxPdf(new Uint8Array(25*1024*1024+1),"neutral.pdf")).rejects.toMatchObject({status:413});
  });
  it("reserves quota, uploads original bytes and finishes only afterwards",async()=>{
    const fetchMock = vi.fn(async(url:string)=>{
      if (url.endsWith("reserve_workspace_inbox")) return Response.json([row("uploading")]);
      if (url.includes("/storage/")) return Response.json({});
      if (url.endsWith("finish_workspace_inbox")) return Response.json([row()]);
      throw new Error("Unexpected request");
    });
    vi.stubGlobal("fetch",fetchMock);
    expect(await receiveInboxPdf(owner,id,"neutral.pdf",bytes)).toMatchObject({id,status:"received"});
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const init = (fetchMock.mock.calls as unknown as [string,RequestInit][])[1][1];
    expect(init.body).toEqual(bytes);
    expect(fetchMock.mock.calls[1][0]).toContain(`/inbox/${owner}/${id}.pdf`);
  });
  it("retries a finished upload without writing the file or duplicating activity",async()=>{
    const fetchMock = vi.fn(async()=>Response.json([row()]));vi.stubGlobal("fetch",fetchMock);
    await receiveInboxPdf(owner,id,"neutral.pdf",bytes);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("does not finish a receipt after a storage outage",async()=>{
    const fetchMock = vi.fn(async(url:string)=>url.includes("/storage/")?new Response("{}",{status:503}):Response.json([row("uploading")]));
    vi.stubGlobal("fetch",fetchMock);
    await expect(receiveInboxPdf(owner,id,"neutral.pdf",bytes)).rejects.toMatchObject({status:503});
    expect(fetchMock.mock.calls.some(([url])=>url.includes("finish_workspace_inbox"))).toBe(false);
  });
  it("fails closed with an unconfigured local adapter",async()=>{
    vi.stubEnv("WORKSPACE_STORAGE_DRIVER","local");
    await expect(receiveInboxPdf(owner,id,"neutral.pdf",bytes)).rejects.toMatchObject({status:503});
  });
});
describe("Inbox API ownership and transitions",()=>{
  it("requires sign-in and same origin before reading upload data",async()=>{
    vi.mocked(getCurrentUser).mockResolvedValue(null);
    expect((await POST(upload())).status).toBe(401);
    expect((await POST(upload("https://elsewhere.example"))).status).toBe(403);
    expect((await GET(new Request("http://localhost/api/studio/inbox"))).status).toBe(401);
  });
  it("rejects an oversized upload before any storage request",async()=>{
    const fetchMock=vi.fn();vi.stubGlobal("fetch",fetchMock);
    const request=upload();request.headers.set("content-length",String(26*1024*1024));
    expect((await POST(request)).status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("blocks inline viewing of a protected file but allows the original download",async()=>{
    vi.stubGlobal("fetch",vi.fn(async(url:string)=>url.includes("/storage/")?
      new Response(Uint8Array.from(bytes)):Response.json([{...row(),protected_pdf:true}])));
    expect((await fileGET(new Request("http://localhost/file?inline=1"),params)).status).toBe(409);
    const download=await fileGET(new Request("http://localhost/file"),params);
    expect(download.status).toBe(200);
    expect(new Uint8Array(await download.arrayBuffer())).toEqual(bytes);
  });
  it("scopes lists to the session owner with a real count and no object keys",async()=>{
    const fetchMock=vi.fn(async(_url:string)=>Response.json([row()],{headers:{"content-range":"0-0/1"}}));vi.stubGlobal("fetch",fetchMock);
    const response=await GET(new Request(`http://localhost/api/studio/inbox?userId=${other}`));
    const payload=await response.json();
    expect(payload.total).toBe(1);expect(payload.receipts[0].object_key).toBeUndefined();
    expect(fetchMock.mock.calls[0][0]).toContain(`user_id=eq.${owner}`);
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
  it("searches filenames server-side without treating filename underscores as wildcards",async()=>{
    const fetchMock=vi.fn(async(_url:string)=>Response.json([],{headers:{"content-range":"*/0"}}));
    vi.stubGlobal("fetch",fetchMock);
    const response=await GET(new Request("http://localhost/api/studio/inbox?status=accepted&offset=50&search=resume_100%25&sort=oldest"));
    expect(response.status).toBe(200);
    const query=new URL(fetchMock.mock.calls[0][0]).searchParams;
    expect(query.get("user_id")).toBe(`eq.${owner}`);
    expect(query.get("status")).toBe("eq.accepted");
    expect(query.get("offset")).toBe("50");
    expect(query.get("order")).toBe("created_at.asc,id.desc");
    expect(query.get("name")).toBe("ilike.%resume\\_100\\%%");
  });
  it.each(["sort=invalid","search="+"x".repeat(181),"offset=-1"])("rejects invalid list filters %s",async query=>{
    const fetchMock=vi.fn();vi.stubGlobal("fetch",fetchMock);
    expect((await GET(new Request(`http://localhost/api/studio/inbox?${query}`))).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it("does not disclose a missing or foreign file or issue a storage read",async()=>{
    const fetchMock=vi.fn(async()=>Response.json([]));vi.stubGlobal("fetch",fetchMock);
    expect((await fileGET(new Request("http://localhost/file"),params)).status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("refuses a mismatched storage object key",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>Response.json([{...row(),object_key:"another-owner/private.pdf"}])));
    expect((await fileGET(new Request("http://localhost/file"),params)).status).toBe(503);
  });
  it("copies intact bytes before accepting, with a separate workspace key",async()=>{
    const fetchMock=vi.fn(async(url:string)=>{
      if (url.includes("/rest/v1/workspace_inbox?")) return Response.json([row()]);
      if (url.includes(`/inbox/${owner}/`)) return new Response(Uint8Array.from(bytes));
      if (url.includes("/inbox-documents/")) return Response.json({});
      if (url.endsWith("accept_workspace_inbox")) return Response.json([{...row("accepted"),document_id:"doc_saved",accepted_at:new Date().toISOString()}]);
      throw new Error("Unexpected request");
    });vi.stubGlobal("fetch",fetchMock);
    const result=await acceptInbox(owner,id);
    expect(result.documentId).toBe("doc_saved");
    const calls=fetchMock.mock.calls as unknown as [string,RequestInit][];
    expect(calls[3][0]).toContain(`/inbox-documents/${owner}/${id}.pdf`);
    expect(calls[3][1].body).toEqual(bytes);
    expect(calls[4][0]).toContain("accept_workspace_inbox");
  });
  it("cannot accept an archived receipt or recreate a deleted accepted document",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>Response.json([row("archived")])));
    expect((await acceptPOST(new Request("http://localhost/accept",{method:"POST",headers:{origin:"http://localhost"}}),params)).status).toBe(409);
    const fetchMock=vi.fn(async()=>Response.json([{...row("accepted"),accepted_at:new Date().toISOString()}]));vi.stubGlobal("fetch",fetchMock);
    expect((await acceptInbox(owner,id)).documentId).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("rejects corrupt stored bytes before copying or acceptance",async()=>{
    const fetchMock=vi.fn(async(url:string)=>url.includes("/storage/")?new Response("corrupt"):Response.json([row()]));vi.stubGlobal("fetch",fetchMock);
    await expect(acceptInbox(owner,id)).rejects.toMatchObject({status:503});
    expect(fetchMock.mock.calls.some(([url])=>url.includes("accept_workspace_inbox"))).toBe(false);
  });
  it("maps quotas safely and validates archive requests",async()=>{
    vi.stubGlobal("fetch",vi.fn(async()=>Response.json({message:"quota_exceeded",details:"private"},{status:400})));
    expect(await (await POST(upload())).json()).toEqual({code:"quota_exceeded"});
    const response=await PATCH(new Request("http://localhost/receipt",{method:"PATCH",headers:{origin:"http://localhost"},body:'{"archive":"yes"}'}),params);
    expect(response.status).toBe(400);
  });
  it("formats international filenames without header injection",()=>{
    expect(workspaceFileDisposition('reçu "test".pdf')).toContain("filename*=UTF-8''re%C3%A7u%20%22test%22.pdf");
    expect(workspaceFileDisposition("bad\r\nname.pdf")).not.toContain("\r");
  });
});
