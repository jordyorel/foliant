import {createServer} from "node:http";
import {spawn} from "node:child_process";
import {once} from "node:events";
import {describe,expect,it} from "vitest";

const secret="qa-worker-process-secret-at-least-32-characters";
async function worker(origin:string) {
  const child=spawn(process.execPath,["scripts/workflow-worker.mjs","--once"],{
    env:{...process.env,MAINTENANCE_SECRET:secret,WORKFLOW_WORKER_ORIGIN:origin},stdio:["ignore","pipe","pipe"]
  });
  let output="";
  child.stderr.on("data",chunk=>{output+=chunk;});
  const [code]=await once(child,"close");
  return {code,output};
}
describe("Independent workflow worker process",()=>{
  it.each([200,503,401])("reports HTTP %i correctly without printing provider details",async status=>{
    const server=createServer((request,response)=>{
      expect(request.method).toBe("POST");
      expect(request.url).toBe("/api/maintenance/workflows");
      expect(request.headers.authorization).toBe(`Bearer ${secret}`);
      response.writeHead(status);response.end("private provider details");
    });
    server.listen(0,"127.0.0.1");await once(server,"listening");
    try {
      const address=server.address() as {port:number};
      const result=await worker(`http://127.0.0.1:${address.port}`);
      expect(result.code).toBe(status===200 ? 0 : 1);
      expect(result.output).not.toContain("private provider details");
      expect(result.output).not.toContain(secret);
    } finally {await new Promise<void>((resolve,reject)=>server.close(error=>error ? reject(error) : resolve()));}
  });
  it("refuses redirects without forwarding the maintenance token",async()=>{
    let forwarded=false;
    const server=createServer((request,response)=>{
      if(request.url==="/forwarded") forwarded=true;
      response.writeHead(307,{location:"/forwarded"});response.end();
    });
    server.listen(0,"127.0.0.1");await once(server,"listening");
    try {
      const address=server.address() as {port:number};
      expect((await worker(`http://127.0.0.1:${address.port}`)).code).toBe(1);
      expect(forwarded).toBe(false);
    } finally {await new Promise<void>(resolve=>server.close(()=>resolve()));}
  });
});
