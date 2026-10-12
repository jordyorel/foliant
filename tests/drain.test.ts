import {afterEach, describe, expect, it, vi} from "vitest";
const begin = vi.hoisted(() => vi.fn());
vi.mock("@/lib/jobs", () => ({beginJobShutdown: begin}));
import {POST} from "@/app/api/maintenance/drain/route";

describe("maintenance drain", () => {
  afterEach(() => {vi.unstubAllEnvs(); begin.mockReset();});
  const secret = "a".repeat(40);
  const request = (authorized: boolean) => new Request("http://localhost/api/maintenance/drain", {
    method: "POST", headers: authorized ? {authorization: `Bearer ${secret}`} : {}
  });
  it("cannot stop admission without authorization", async () => {
    vi.stubEnv("MAINTENANCE_SECRET", secret);
    expect((await POST(request(false))).status).toBe(401);
    expect(begin).not.toHaveBeenCalled();
  });
  it.each([false, true])("reports whether accepted work has drained: %s", async drained => {
    vi.stubEnv("MAINTENANCE_SECRET", secret);
    begin.mockReturnValue({stopping: true, active: drained ? 0 : 1, pending: 0, drained});
    const response = await POST(request(true));
    expect(response.status).toBe(drained ? 200 : 202);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).drained).toBe(drained);
  });
});
