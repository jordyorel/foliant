import {describe, expect, it} from "vitest";
import {POST as initUpload} from "@/app/api/upload/init/route";
import {PUT as putUpload} from "@/app/api/upload/[fileId]/route";
import {POST as createJobRoute} from "@/app/api/jobs/route";
import {GET as jobRoute} from "@/app/api/jobs/[jobId]/route";
import {GET as previewRoute} from "@/app/api/jobs/[jobId]/preview/route";
import {GET as sourceRoute} from "@/app/api/jobs/[jobId]/source-preview/route";
import {GET as downloadRoute} from "@/app/api/jobs/[jobId]/download/route";
import {POST as closeRoute} from "@/app/api/jobs/[jobId]/close/route";
import {POST as saveRoute} from "@/app/api/studio/documents/route";
import {canAccessGuestJob, getJob, publicJob, touchGuestClient} from "@/lib/jobs";
import {getResultFile, resultTtlMs} from "@/lib/storage/local";
import {fixtureBytes, pollJob} from "./helpers";

const owner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
function request(body?: unknown, session = owner) {
  return new Request("http://localhost/api", {
    method: body ? "POST" : "GET",
    headers: {cookie: `foliant_guest_session=${session}`, "content-type": "application/json", origin: "http://localhost"},
    body: body ? JSON.stringify(body) : undefined
  });
}

describe("temporary session ownership", () => {
  it("issues a private browser-session cookie on first upload", async () => {
    const response = await initUpload(new Request("http://localhost/api", {
      method: "POST", body: JSON.stringify({tool: "rotate_pdf", options: {rotateDegrees: 90}, fileName: "test.pdf", fileSize: 100, mimeType: "application/pdf"})
    }));
    const cookie = response.headers.get("set-cookie");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=strict");
    expect(cookie).not.toContain("Max-Age");
  });

  it("denies other sessions and revokes an entire tool chain without affecting another job", async () => {
    const bytes = fixtureBytes("light.pdf");
    const init = await (await initUpload(request({tool: "rotate_pdf", options: {rotateDegrees: 90}, fileName: "test.pdf", fileSize: bytes.length, mimeType: "application/pdf"}))).json();
    const uploadParams = {params: Promise.resolve({fileId: init.fileId})};
    const put = (session: string) => new Request("http://localhost/api", {method: "PUT", headers: {cookie: `foliant_guest_session=${session}`}, body: new Uint8Array(bytes)});
    expect((await putUpload(put(other), uploadParams)).status).toBe(404);
    expect((await putUpload(put(owner), uploadParams)).status).toBe(200);
    expect((await createJobRoute(request({tool: "rotate_pdf", options: {rotateDegrees: 90}, fileIds: [init.fileId]}, other))).status).toBe(404);
    const created = await (await createJobRoute(request({tool: "rotate_pdf", options: {rotateDegrees: 90}, fileIds: [init.fileId]}))).json();
    expect(created).not.toHaveProperty("guestSessionId");
    expect(created).not.toHaveProperty("guestChainId");
    await pollJob(created.id);
    const params = {params: Promise.resolve({jobId: created.id})};
    for (const route of [jobRoute, previewRoute, sourceRoute, downloadRoute]) {
      expect((await route(request(undefined, other), params)).status).toBe(404);
      expect((await route(new Request("http://localhost/api"), params)).status).toBe(404);
      expect((await route(request(), params)).status).toBe(200);
    }
    expect((await saveRoute(request({jobId: created.id}, other))).status).toBe(401);
    expect((await createJobRoute(request({tool: "rotate_pdf", options: {rotateDegrees: 90}, sourceJobId: created.id}, other))).status).toBe(404);
    const child = await (await createJobRoute(request({tool: "rotate_pdf", options: {rotateDegrees: 90}, sourceJobId: created.id, source: "result"}))).json();
    const unrelated = await (await createJobRoute(request({tool: "rotate_pdf", options: {rotateDegrees: 90}, fileIds: [init.fileId]}))).json();
    await pollJob(child.id);
    await pollJob(unrelated.id);
    const firstTab = crypto.randomUUID();
    const secondTab = crypto.randomUUID();
    touchGuestClient(created.id, owner, firstTab);
    touchGuestClient(child.id, owner, secondTab);
    expect((await closeRoute(request({clientId: firstTab}, other), params)).status).toBe(404);
    expect((await closeRoute(request({clientId: firstTab}), params)).status).toBe(204);
    expect(canAccessGuestJob(getJob(child.id), owner)).toBe(true);
    expect((await closeRoute(request({clientId: secondTab}), params)).status).toBe(204);
    expect((await jobRoute(request(), params)).status).toBe(404);
    expect(canAccessGuestJob(getJob(child.id), owner)).toBe(false);
    expect(canAccessGuestJob(getJob(unrelated.id), owner)).toBe(true);
    expect(getResultFile(created.id)).toBeNull();
    expect(getResultFile(child.id)).toBeNull();
    const job = getJob(unrelated.id)!;
    expect(publicJob({...job, options: {pdfPassword: "never-return-this"}}).options).not.toHaveProperty("pdfPassword");
    expect(canAccessGuestJob({...job, createdAt: Date.now() - resultTtlMs - 1}, owner)).toBe(false);
    touchGuestClient(unrelated.id, owner, firstTab);
    await closeRoute(request({clientId: firstTab}), {params: Promise.resolve({jobId: unrelated.id})});
  });
});
