import createMiddleware from "next-intl/middleware";
import {routing} from "./lib/i18n/routing";
import {NextRequest, NextResponse} from "next/server";
import {refreshAuth} from "./lib/auth/proxy";

const localize = createMiddleware(routing);

export default async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return refreshAuth(request, (updated) => NextResponse.next({request: {headers: updated.headers}}));
  }
  if (request.nextUrl.pathname.includes("/studio")) return refreshAuth(request, localize);
  return localize(request);
}

export const config = {
  matcher: ["/", "/(fr|en|es|pt)/:path*", "/api/studio/:path*", "/api/auth/:path*", "/api/jobs"]
};
