import {NextResponse} from "next/server";
import {cleanupExpiredFiles, cleanupOrphanResults} from "@/lib/storage/local";
import {authorizeMaintenance} from "@/lib/jobs/maintenance-auth";
import {logOperationalEvent} from "@/lib/operations/log";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = authorizeMaintenance(request);
  if (denied) return denied;
  const headers = {"Cache-Control": "no-store"};

  try {
    const deleted = await cleanupExpiredFiles();
    const orphans = await cleanupOrphanResults();
    const {cleanupExpiredJobState} = await import("@/lib/jobs");
    const jobs = cleanupExpiredJobState();
    return NextResponse.json({deleted: {...deleted, jobs, orphans}}, {headers});
  } catch {
    logOperationalEvent("cleanup_failed");
    // Never return filesystem paths or document metadata to the scheduler.
    return NextResponse.json({error: "Temporary cleanup failed"}, {status: 500, headers});
  }
}
