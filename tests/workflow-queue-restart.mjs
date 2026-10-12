// Destructive shutdown is restricted to the disposable QA cluster, never Supabase.
// Prerequisite: workflow-queue.sql loaded in this cluster's isolated postgres database.
import assert from "node:assert/strict";
import {execFileSync,spawn} from "node:child_process";
import {once} from "node:events";
import {createServer} from "node:http";
import {readFile,mkdir,copyFile} from "node:fs/promises";
import {createHash,randomUUID} from "node:crypto";
import path from "node:path";
import {PDFDocument} from "pdf-lib";

const cluster=path.resolve(".tmp/qa/workflow-queue-pg");
const pgctl=process.env.PG_CTL_BIN ?? "/opt/homebrew/opt/postgresql@18/bin/pg_ctl";
const psql=process.env.PSQL_BIN ?? "/opt/homebrew/bin/psql";
const args=["-h",cluster,"-p","55440","-d","postgres","-At","-v","ON_ERROR_STOP=1"];
const owner="00000000-0000-0000-0000-000000000001";
const reviewer="00000000-0000-0000-0000-000000000002";
const query=sql=>execFileSync(psql,[...args,"-c",sql],{encoding:"utf8"}).trim();
const literal=value=>`'${String(value).replaceAll("'","''")}'`;
assert.equal(query(`select email from auth.users where id='${owner}'`),"owner@example.test");
assert.equal(query("show data_directory"),cluster);
const directory=path.resolve(".tmp/qa",`restart-${randomUUID()}`);
await mkdir(directory,{recursive:true});
const pdfPath=path.join(directory,"neutral.pdf");
await copyFile("tests/fixtures/light.pdf",pdfPath);
const bytes=await readFile(pdfPath);
const pdf=await PDFDocument.load(bytes);
assert.ok(pdf.getPageCount()>0);
const hash=createHash("sha256").update(bytes).digest("hex");
const rule=randomUUID();
query(`insert into public.workspace_workflows(id,user_id,name,recipient_email,created_at) values('${rule}','${owner}','Restart QA','reviewer@example.test',now()-interval '1 day');`);
// Old fixture rules must not create additional approval requests for the new QA PDFs.
query(`update public.workspace_workflows set enabled=false where id<>'${rule}';`);
const documents=[];
function enqueue() {
  const id=`restart_${randomUUID()}`;documents.push(id);
  const version=`version_${randomUUID()}`;
  query(`begin;
    insert into public.workspace_documents(id,user_id,source_job_id,name,kind_tool,result_object_key,result_file_name,result_mime_type,result_size,page_count)
      values('${id}','${owner}','qa_restart','neutral.pdf','rotate_pdf',${literal(pdfPath)},'neutral.pdf','application/pdf',${bytes.length},${pdf.getPageCount()});
    insert into public.workspace_document_versions(id,document_id,source_job_id,version_number,kind_tool,result_object_key,result_file_name,result_mime_type,result_size,page_count)
      values('${version}','${id}','qa_restart',1,'rotate_pdf',${literal(pdfPath)},'neutral.pdf','application/pdf',${bytes.length},${pdf.getPageCount()});
    commit;`);
  assert.equal(query(`select public.enqueue_workspace_workflows('${owner}','${id}')`),"1");
  return {id,version};
}
function restart() {
  execFileSync(pgctl,["-D",cluster,"stop","-m","immediate"],{stdio:"pipe"});
  execFileSync(pgctl,["-D",cluster,"-l",path.join(directory,"postgres.log"),"-o",`-k ${cluster} -p 55440 -h ''`,"start"],{stdio:"pipe"});
}
function counts(id) {
  return JSON.parse(query(`select json_build_object('approvals',(select count(*) from public.workspace_approvals where document_id='${id}'),'events',(select count(*) from public.workspace_activity where document_id='${id}'),'status',(select status from public.workspace_workflow_runs where document_id='${id}'))`));
}
const secret=`qa-${randomUUID()}`;
let loseResponse=false;
let calls=0;
// Loopback harness calls the real SQL RPC. It is not the production Next.js/Supabase HTTP gateway.
const server=createServer((request,response)=>{
  if(request.method!=="POST" || request.url!=="/api/maintenance/workflows" || request.headers.authorization!==`Bearer ${secret}`) {response.writeHead(401);response.end();return;}
  const child=spawn(psql,[...args,"-c",`select public.process_workspace_workflows('${owner}',10)`],{env:{...process.env,PGAPPNAME:"foliant_restart_qa_worker"},stdio:["ignore","pipe","pipe"]});
  let output="";child.stdout.on("data",chunk=>{output+=chunk;});
  child.once("close",code=>{
    calls++;
    if(code===0 && loseResponse) {response.destroy();return;}
    response.writeHead(code===0 ? 200 : 503,{"Content-Type":"application/json"});
    response.end(JSON.stringify(code===0 ? {processed:Number(output.trim())} : {error:"Unavailable"}));
  });
});
server.listen(0,"127.0.0.1");await once(server,"listening");
const origin=`http://127.0.0.1:${server.address().port}`;
const children=new Set();
function worker() {
  const child=spawn(process.execPath,["scripts/workflow-worker.mjs","--once"],{env:{...process.env,MAINTENANCE_SECRET:secret,WORKFLOW_WORKER_ORIGIN:origin},stdio:["ignore","pipe","pipe"]});
  children.add(child);child.once("close",()=>children.delete(child));
  child.stderr.resume();child.stdout.resume();
  return once(child,"close").then(([code])=>code);
}
try {
  const first=enqueue();
  restart();
  assert.deepEqual(counts(first.id),{approvals:0,events:0,status:"running"});
  assert.equal(await worker(),0);
  assert.deepEqual(counts(first.id),{approvals:1,events:1,status:"succeeded"});

  const interrupted=enqueue();
  query(`create function public.qa_pause_workflow_result() returns trigger language plpgsql as $$begin if new.document_id='${interrupted.id}' then perform pg_sleep(30); end if; return new; end$$;
    create trigger qa_restart_pause before update on public.workspace_workflow_runs for each row execute function public.qa_pause_workflow_result();`);
  const crashed=worker();
  const deadline=Date.now()+10000;
  while(query("select count(*) from pg_stat_activity where application_name='foliant_restart_qa_worker' and wait_event='PgSleep'")!=="1") {
    assert.ok(Date.now()<deadline,"Transaction did not reach injected pause");
    await new Promise(resolve=>setTimeout(resolve,50));
  }
  restart();
  assert.equal(await crashed,1);
  assert.deepEqual(counts(interrupted.id),{approvals:0,events:0,status:"running"});
  query("drop trigger qa_restart_pause on public.workspace_workflow_runs; drop function public.qa_pause_workflow_result();");
  assert.equal(await worker(),0);
  assert.deepEqual(counts(interrupted.id),{approvals:1,events:1,status:"succeeded"});

  const lost=enqueue();loseResponse=true;
  assert.equal(await worker(),1);
  loseResponse=false;
  assert.deepEqual(counts(lost.id),{approvals:1,events:1,status:"succeeded"});
  assert.equal(await worker(),0);
  assert.deepEqual(counts(lost.id),{approvals:1,events:1,status:"succeeded"});
  for(const doc of [first,interrupted,lost]) {
    assert.equal(query(`select version_id from public.workspace_approvals where document_id='${doc.id}'`),doc.version);
    assert.equal(query(`set role authenticated; select set_config('request.jwt.claim.sub','${reviewer}',false); select count(*) from public.workspace_workflow_runs where document_id='${doc.id}'`).split("\n").at(-1),"0");
  }
  assert.equal(createHash("sha256").update(await readFile(pdfPath)).digest("hex"),hash);
  query(`update public.workspace_workflows set enabled=false,archived_at=now() where id='${rule}';`);
  console.log(JSON.stringify({result:"Restart QA passed",scenarios:3,workerCalls:calls,approvals:3,pdfUnchanged:true,scope:"local PostgreSQL + real worker; loopback HTTP harness",pdf:pdfPath}));
} finally {
  for(const child of children) child.kill("SIGTERM");
  await new Promise(resolve=>server.close(resolve));
}
