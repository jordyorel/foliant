// Run only after workflow-queue.sql in an isolated QA database.
import {spawn,execFileSync} from "node:child_process";
import {once} from "node:events";
import assert from "node:assert/strict";

const args=process.argv.slice(2);
const psql=process.env.PSQL_BIN ?? "/opt/homebrew/bin/psql";
const query=sql=>execFileSync(psql,[...args,"-At","-v","ON_ERROR_STOP=1","-c",sql],{encoding:"utf8"}).trim();
assert.equal(query("select email from auth.users where id='00000000-0000-0000-0000-000000000001'"),"owner@example.test");
query("update public.workspace_workflows set enabled=true,archived_at=null,updated_at=null where id='10000000-0000-0000-0000-000000000001'; select public.enqueue_workspace_workflows('00000000-0000-0000-0000-000000000001','doc_6');");
const first=spawn(psql,[...args,"-At","-v","ON_ERROR_STOP=1"],{stdio:["pipe","pipe","inherit"]});
const completed=once(first,"close");
try {
  const locked=new Promise((resolve,reject)=>{
    let output="";
    const timeout=setTimeout(()=>reject(new Error("QA lock timed out")),20000);
    first.once("error",error=>{clearTimeout(timeout);reject(error);});
    first.stdout.on("data",chunk=>{output+=chunk; if(output.includes("QA_LOCKED")) {clearTimeout(timeout);resolve();}});
  });
  first.stdin.write("begin; select id from public.workspace_workflow_runs where document_id='doc_6' for update; select 'QA_LOCKED';\n");
  await locked;
  assert.equal(query("select public.process_workspace_workflows(null,10)"),"0");
  first.stdin.end("commit;\n");
  const [code]=await completed;assert.equal(code,0);
  assert.equal(query("select public.process_workspace_workflows(null,10)"),"1");
  assert.equal(query("select public.process_workspace_workflows(null,10)"),"0");
  assert.equal(query("select count(*) from public.workspace_approvals where document_id='doc_6'"),"1");
  console.log("SQL concurrent-worker QA passed: locked work skipped; exactly one approval after release");
} finally {
  if(first.exitCode===null) {first.stdin.end("rollback;\n");await completed;}
}
