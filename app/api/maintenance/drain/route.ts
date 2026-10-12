import {NextResponse} from "next/server";
import {authorizeMaintenance} from "@/lib/jobs/maintenance-auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const denied = authorizeMaintenance(request);
  if (denied) return denied;
  const {beginJobShutdown} = await import("@/lib/jobs");
  const state = beginJobShutdown();
  return NextResponse.json(state, {
    status: state.drained ? 200 : 202,
    headers: {"Cache-Control": "no-store", "Retry-After": "2"}
  });
}
