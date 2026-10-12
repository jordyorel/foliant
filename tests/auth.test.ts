import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {createServerClient} from "@supabase/ssr";
import {GET, POST} from "@/app/api/auth/route";
import {GET as callback} from "@/app/auth/callback/route";
import {getCurrentUser} from "@/lib/auth/server";
import {createLoginAttempt, loginAttemptCookie} from "@/lib/auth/login-attempts";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), signInWithOtp: vi.fn(), exchangeCodeForSession: vi.fn(), setSession: vi.fn(), signOut: vi.fn(),
  set: vi.fn(), getAll: vi.fn(() => [])
}));
vi.mock("@supabase/ssr", () => ({createServerClient: vi.fn(() => ({auth: mocks}))}));
vi.mock("next/headers", () => ({cookies: async () => ({getAll: mocks.getAll, set: mocks.set})}));

function request(body: unknown, origin = "http://localhost", cookie?: string) {
  return new Request("http://localhost/api/auth", {method: "POST", headers: {origin, "content-type": "application/json", ...(cookie ? {cookie} : {})}, body: JSON.stringify(body)});
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("SUPABASE_URL", "https://project.example.invalid");
  vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test_only");
  vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_test_only");
  mocks.getUser.mockResolvedValue({data: {user: null}, error: null});
  mocks.signInWithOtp.mockResolvedValue({error: null});
  mocks.exchangeCodeForSession.mockResolvedValue({data: {session: {access_token: "access-token", refresh_token: "refresh-token"}}, error: null});
  mocks.setSession.mockResolvedValue({data: {user: {id: "verified-user", email: "owner@example.test"}}, error: null});
  mocks.signOut.mockResolvedValue({error: null});
});
afterEach(() => vi.unstubAllEnvs());

describe("server-side magic-link auth", () => {
  it("fails closed when the publishable key is absent, never falling back to the secret", async () => {
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "");
    vi.stubEnv("SUPABASE_SECRET_KEY", "must-not-be-used");
    expect(await getCurrentUser(new Request("http://localhost"))).toBeNull();
    expect((await POST(request({action: "send", email: "owner@example.test"}))).status).toBe(503);
    expect(createServerClient).not.toHaveBeenCalled();
  });

  it("rejects cross-origin auth requests and malformed input", async () => {
    expect((await POST(request({action: "send", email: "owner@example.test"}, "https://untrusted.example"))).status).toBe(403);
    expect((await POST(request({action: "send", email: "invalid"}))).status).toBe(400);
    expect((await POST(request({action: "verify", email: "owner@example.test", token: "wrong"}))).status).toBe(400);
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
  });

  it("sends a magic link with a safe callback and handles throttling", async () => {
    expect((await POST(request({action: "send", email: " owner@example.test ", next: "/fr/studio/documents/job_123?entry=guest"}))).status).toBe(200);
    const redirect = new URL(mocks.signInWithOtp.mock.calls[0][0].options.emailRedirectTo);
    expect(redirect.origin).toBe("http://localhost");
    expect(redirect.pathname).toBe("/auth/callback");
    expect(redirect.searchParams.get("next")).toBe("/fr/studio/documents/job_123?entry=guest");
    expect(redirect.searchParams.get("locale")).toBe("fr");
    expect(redirect.searchParams.get("attempt")).toMatch(/^[a-f0-9-]{36}$/);
    mocks.signInWithOtp.mockResolvedValueOnce({error: {status: 429}});
    expect((await POST(request({action: "send", email: "owner@example.test"}))).status).toBe(429);
  });

  it("confirms a Magic Link and lets the originating browser claim its session once", async () => {
    const attempt = await createLoginAttempt();
    const response = await callback(new Request(`http://localhost/auth/callback?code=test-code&attempt=${attempt.id}&next=/fr/studio/documents/job_123?entry=guest&locale=fr`));
    expect(response.status).toBe(200);
    expect(await response.text()).toContain("Connexion réussie");
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("test-code");
    const complete = await POST(request({action: "complete"}, "http://localhost", `${loginAttemptCookie}=${attempt.cookie}`));
    expect(await complete.json()).toMatchObject({complete: true, user: {id: "verified-user"}});
    expect(mocks.setSession).toHaveBeenCalledWith({access_token: "access-token", refresh_token: "refresh-token"});
    expect((await POST(request({action: "complete"}, "http://localhost", `${loginAttemptCookie}=${attempt.cookie}`))).json()).resolves.toEqual({complete: false});
    expect((await callback(new Request("http://localhost/auth/callback?next=https://untrusted.example"))).status).toBe(400);
  });

  it("validates the user with Supabase, including after the request body was consumed", async () => {
    mocks.getUser.mockResolvedValue({data: {user: {id: "verified-user", email: "owner@example.test"}}, error: null});
    const consumed = request({arbitrary: "body"});
    await consumed.json();
    expect(await getCurrentUser(consumed)).toEqual({id: "verified-user", email: "owner@example.test"});
    const response = await GET(new Request("http://localhost/api/auth"));
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(mocks.getUser).toHaveBeenCalledTimes(2);
    expect(vi.mocked(createServerClient).mock.calls[0][2]?.cookieOptions).toMatchObject({httpOnly: true, sameSite: "lax"});
    mocks.getUser.mockResolvedValue({data: {user: null}, error: {message: "invalid JWT"}});
    expect(await getCurrentUser(new Request("http://localhost"))).toBeNull();
  });

  it("signs out locally and clears the temporary-session credential", async () => {
    const response = await POST(request({action: "signout"}));
    expect(response.status).toBe(200);
    expect(mocks.signOut).toHaveBeenCalledWith({scope: "local"});
    expect(response.headers.get("set-cookie")).toContain("foliant_guest_session=");
  });
});
