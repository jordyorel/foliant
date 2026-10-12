import {createServerClient} from "@supabase/ssr";
import {NextRequest, NextResponse} from "next/server";
import {authConfig, authCookieOptions} from "./config";

export async function refreshAuth(request: NextRequest, responseFor: (request: NextRequest) => NextResponse) {
  const config = authConfig();
  let response = responseFor(request);
  if (!config) return response;
  const client = createServerClient(config.url, config.key, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({name, value}) => request.cookies.set(name, value));
        response = responseFor(request);
        values.forEach(({name, value, options}) => response.cookies.set(name, value, options));
      }
    }
  });
  await client.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
