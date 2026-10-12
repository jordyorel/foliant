// Run only in the disposable database initialized by workflow-queue.sql and inbox.sql.
import {spawn,execFileSync} from "node:child_process";
import {once} from "node:events";
import assert from "node:assert/strict";

const args=process.argv.slice(2);
const psql=process.env.PSQL_BIN ?? "/opt/homebrew/bin/psql";
const query=sql=>execFileSync(psql,[...args,"-At","-v","ON_ERROR_STOP=1","-c",sql],{encoding:"utf8"}).trim();
const owner="00000000-0000-0000-0000-000000000001";
const request="33333333-3333-4333-8333-333333333333";
assert.equal(query(`select email from auth.users where id='${owner}'`),"owner@example.test");
query("update public.workspace_workflows set enabled=false;");
const id=query(`select id from public.reserve_workspace_inbox('${owner}','${request}','concurrent.pdf',500,repeat('b',64),1,false);`);
query(`select id from public.finish_workspace_inbox('${owner}','${id}');`);
const first=spawn(psql,[...args,"-At","-v","ON_ERROR_STOP=1"],{stdio:["pipe","pipe","inherit"]});
const firstDone=once(first,"close");
let second;
let secondDone;
try {
  const locked=new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error("Inbox lock timed out")),10000);
    let output="";
    first.once("error",error=>{clearTimeout(timer);reject(error);});
    first.stdout.on("data",chunk=>{
      output+=chunk;
      if(output.includes("QA_LOCKED")) {clearTimeout(timer);resolve();}
    });
  });
  first.stdin.write(`begin; select document_id from public.accept_workspace_inbox('${owner}','${id}'); select 'QA_LOCKED';\n`);
  await locked;
  second=spawn(psql,[...args,"-At","-v","ON_ERROR_STOP=1","-c",`set application_name='qa_inbox_second'; set statement_timeout='15s'; select document_id from public.accept_workspace_inbox('${owner}','${id}');`],{stdio:["ignore","pipe","inherit"]});
  secondDone=once(second,"close");
  let output="";
  second.stdout.on("data",chunk=>{output+=chunk;});
  const deadline=Date.now()+10000;
  while(query("select count(*) from pg_stat_activity where application_name='qa_inbox_second' and wait_event_type='Lock';")!=="1") {
    if(Date.now()>deadline) throw new Error("Second acceptance did not block on the first");
    await new Promise(resolve=>setTimeout(resolve,25));
  }
  first.stdin.end("commit;\n");
  assert.equal((await firstDone)[0],0);
  assert.equal((await secondDone)[0],0);
  const documentId=query(`select document_id from public.workspace_inbox where id='${id}';`);
  assert.ok(output.includes(documentId));
  assert.equal(query(`select count(*) from public.workspace_documents where source_inbox_id='${id}';`),"1");
  assert.equal(query(`select count(*) from public.workspace_document_versions where source_inbox_id='${id}';`),"1");
  assert.equal(query(`select count(*) from public.workspace_inbox_events where receipt_id='${id}' and action='accepted';`),"1");
  console.log("Inbox concurrent acceptance QA passed: two connections, one document, one V1, one event");
} finally {
  if(first.exitCode===null) {first.stdin.end("rollback;\n");await firstDone;}
  if(second && second.exitCode===null) await secondDone;
  query(`delete from public.workspace_documents where source_inbox_id='${id}'; delete from public.workspace_inbox where id='${id}';`);
}
