import {createServerClient} from "@supabase/ssr";
import {cookies} from "next/headers";
import {NextRequest} from "next/server";
import {authConfig, authCookieOptions} from "./config";

export type AuthCookieUpdate = {name: string; value: string; options: Record<string, unknown>};

export async function createAuthClient(request?: Request, onCookies?: (values: AuthCookieUpdate[]) => void) {
  const config = authConfig();
  if (!config) return null;
  const store = request ? new NextRequest(request.url, {headers: request.headers}).cookies : await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        values.forEach(({name, value, options}) => store.set(name, value, options));
        if (onCookies) onCookies(values);
        // Server components cannot write cookies; the proxy handles refreshes there.
      }
    }
  });
}

export async function getCurrentUser(request?: Request) {
  const client = await createAuthClient(request);
  if (!client) return null;
  const {data, error} = await client.auth.getUser();
  if (error || !data.user) return null;
  return {id: data.user.id, email: data.user.email ?? ""};
}
