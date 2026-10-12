import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
const cleanup = vi.hoisted(() => vi.fn());
vi.mock("@/lib/storage/local", () => ({cleanupExpiredFiles: cleanup, cleanupOrphanResults: async () => 0}));
vi.mock("@/lib/jobs", () => ({cleanupExpiredJobState: () => 0}));
import {POST} from "@/app/api/maintenance/cleanup/route";

const secret = "test-maintenance-secret-at-least-32-characters";
function request(token?: string) {
  return new Request("http://localhost/api/maintenance/cleanup", {
    method: "POST", headers: token ? {authorization: token} : {}
  });
}

describe("scheduled temporary cleanup", () => {
  beforeEach(() => {vi.stubEnv("MAINTENANCE_SECRET", secret); cleanup.mockReset();});
  afterEach(() => vi.unstubAllEnvs());

  it.each(["", "short"])("fails closed with absent or weak configuration: %s", async value => {
    vi.stubEnv("MAINTENANCE_SECRET", value);
    expect((await POST(request())).status).toBe(503);
    expect(cleanup).not.toHaveBeenCalled();
  });

  it.each([undefined, "Bearer incorrect", `Bearer ${"x".repeat(secret.length)}`])("rejects invalid credentials", async token => {
    expect((await POST(request(token))).status).toBe(401);
    expect(cleanup).not.toHaveBeenCalled();
  });

  it("returns only deletion counts and disables caching", async () => {
    cleanup.mockResolvedValue({uploads: 2, results: 1});
    const response = await POST(request(`Bearer ${secret}`));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({deleted: {uploads: 2, results: 1, jobs: 0, orphans: 0}});
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("reports failure without exposing filesystem details", async () => {
    cleanup.mockRejectedValue(new Error("private/document/path"));
    const response = await POST(request(`Bearer ${secret}`));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("private/document/path");
  });
});
