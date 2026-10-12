import {timingSafeEqual} from "node:crypto";
import {NextResponse} from "next/server";

export function authorizeMaintenance(request: Request) {
  const secret = process.env.MAINTENANCE_SECRET;
  const headers = {"Cache-Control": "no-store"};
  if (!secret || secret.length < 32) {
    return NextResponse.json({error: "Maintenance is not configured"}, {status: 503, headers});
  }
  const supplied = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) {
    return NextResponse.json({error: "Unauthorized"}, {status: 401, headers});
  }
  return null;
}
