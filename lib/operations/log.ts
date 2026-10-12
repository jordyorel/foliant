import {toolActions} from "@/content/tools/actions";
import {ErrorCode} from "@/lib/validation/errors";

type Event = "job_completed" | "job_failed" | "cleanup_failed" | "worker_failed" | "upload_failed" | "activity_failed" | "workflow_failed";
const tools = new Set<string>(Object.values(toolActions));
const codes = new Set<string>(Object.values(ErrorCode));

// Deliberately no Error, message, path, filename, identity or arbitrary context.
export function logOperationalEvent(event: Event, fields: {tool?: string; code?: string; durationMs?: number} = {}) {
  const record = {
    event, timestamp: new Date().toISOString(),
    ...(fields.tool && tools.has(fields.tool) ? {tool: fields.tool} : {}),
    ...(fields.code && codes.has(fields.code) ? {code: fields.code} : {}),
    ...(Number.isFinite(fields.durationMs) && fields.durationMs! >= 0 ? {durationMs: Math.round(fields.durationMs!)} : {})
  };
  console.info(JSON.stringify(record));
}
