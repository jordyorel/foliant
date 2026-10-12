import {NextResponse} from "next/server";
import {authConfig, isSameOrigin} from "@/lib/auth/config";
import {createAuthClient, getCurrentUser, type AuthCookieUpdate} from "@/lib/auth/server";
import {claimLoginAttempt, createLoginAttempt, discardLoginAttempt, loginAttemptCookie} from "@/lib/auth/login-attempts";
import {guestSessionCookie, guestSessionId} from "@/lib/studio/guest-session";
import {revokeGuestSession} from "@/lib/jobs";
import {limitRequest} from "@/lib/validation/rate-limit";
import {readLimitedJson} from "@/lib/validation/body";

const headers = {"Cache-Control": "private, no-store"};

function withAuthCookies(response: NextResponse, values: AuthCookieUpdate[]) {
  values.forEach(({name, value, options}) => response.cookies.set(name, value, options));
  return response;
}

function safeNext(value: unknown, fallback: string) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

function safeLocale(value: unknown) {
  return typeof value === "string" && ["fr", "en", "es", "pt"].includes(value) ? value : "fr";
}

export async function GET(request: Request) {
  return NextResponse.json({user: await getCurrentUser(request), configured: Boolean(authConfig())}, {headers});
}

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return NextResponse.json({error: "Invalid origin"}, {status: 403, headers});
  const body = await readLimitedJson(request, 8192).catch(() => null);
  if (!body || !["send", "signout", "complete"].includes(body.action)) {
    return NextResponse.json({error: "Invalid request"}, {status: 400, headers});
  }
  if (body.action !== "complete") {
    const limited = limitRequest(request, "auth");
    if (limited) return limited;
  }
  const cookieUpdates: AuthCookieUpdate[] = [];
  const client = await createAuthClient(request, (values) => cookieUpdates.push(...values));
  if (!client) return NextResponse.json({error: "Auth not configured"}, {status: 503, headers});
  if (body.action === "complete") {
    const session = await claimLoginAttempt(request);
    if (!session) return NextResponse.json({complete: false}, {headers});
    const {data, error} = await client.auth.setSession(session);
    if (error || !data.user) return NextResponse.json({error: "Unable to complete sign-in"}, {status: 503, headers});
    const response = NextResponse.json({complete: true, user: {id: data.user.id, email: data.user.email ?? ""}}, {headers});
    response.cookies.delete(loginAttemptCookie);
    return withAuthCookies(response, cookieUpdates);
  }
  if (body.action === "signout") {
    const {error} = await client.auth.signOut({scope: "local"});
    if (error) return NextResponse.json({ok: false}, {status: 503, headers});
    await revokeGuestSession(guestSessionId(request));
    const response = NextResponse.json({ok: true}, {headers});
    response.cookies.delete(guestSessionCookie);
    return withAuthCookies(response, cookieUpdates);
  }
  const email = typeof body.email === "string" ? body.email.trim() : "";
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({error: "Invalid email"}, {status: 400, headers});
  }
  const next = safeNext(body.next, "/fr/studio");
  const locale = safeLocale(body.locale);
  let attempt: Awaited<ReturnType<typeof createLoginAttempt>>;
  try {
    attempt = await createLoginAttempt();
  } catch {
    return NextResponse.json({error: "Auth unavailable"}, {status: 503, headers});
  }
  const callbackUrl = new URL("/auth/callback", request.url);
  callbackUrl.searchParams.set("attempt", attempt.id);
  callbackUrl.searchParams.set("next", next);
  callbackUrl.searchParams.set("locale", locale);
  const {error} = await client.auth.signInWithOtp({email, options: {shouldCreateUser: true, emailRedirectTo: callbackUrl.toString()}});
  if (error) await discardLoginAttempt(attempt.id);
  const response = NextResponse.json({ok: !error}, {status: error ? (error.status === 429 ? 429 : 400) : 200, headers});
  if (!error) response.cookies.set(loginAttemptCookie, attempt.cookie, {
    httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 10 * 60
  });
  return withAuthCookies(response, cookieUpdates);
}
