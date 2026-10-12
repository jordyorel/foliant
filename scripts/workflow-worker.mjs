import {setTimeout} from "node:timers/promises";

const secret = process.env.MAINTENANCE_SECRET;
if (!secret || secret.length < 32) throw new Error("Configure MAINTENANCE_SECRET (at least 32 characters)");
const origin = new URL(process.env.WORKFLOW_WORKER_ORIGIN ?? "http://localhost:3000");
if (origin.protocol !== "https:" && !(origin.protocol === "http:" && ["localhost","127.0.0.1","[::1]"].includes(origin.hostname))) throw new Error("Worker requires HTTPS outside localhost");
if (origin.username || origin.password) throw new Error("Worker URL must not include credentials");
const endpoint = new URL("/api/maintenance/workflows",origin);
let stopping = false;
const once = process.argv.includes("--once");
for (const signal of ["SIGTERM","SIGINT"]) process.on(signal,() => {stopping = true;});
do {
  try {
    const response = await fetch(endpoint,{method:"POST",headers:{Authorization:`Bearer ${secret}`},signal:AbortSignal.timeout(15000),redirect:"error"});
    if (!response.ok) {
      console.error(`Workflow worker: HTTP ${response.status}`);
      if (once) process.exitCode = 1;
    }
  } catch {
    console.error("Workflow worker: server unavailable; durable queue retained");
    if (once) process.exitCode = 1;
  }
  if (!stopping && !once) await setTimeout(15000);
} while (!stopping && !once);
