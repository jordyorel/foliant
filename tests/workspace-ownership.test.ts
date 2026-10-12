import {afterAll, describe, expect, it, vi} from "vitest";
import {getCurrentUser} from "@/lib/auth/server";
import {createJob} from "@/lib/jobs";
import {createTemporaryFile, saveTemporaryFile} from "@/lib/storage/local";
import {deleteWorkspaceDocument, saveJobResultToWorkspace, listWorkspaceDocumentVersions} from "@/lib/workspace/documents";
import {GET as list} from "@/app/api/studio/documents/route";
import {POST as save} from "@/app/api/studio/documents/route";
import {GET as detail, DELETE as remove} from "@/app/api/studio/documents/[documentId]/route";
import {GET as preview} from "@/app/api/studio/documents/[documentId]/preview/route";
import {GET as download} from "@/app/api/studio/documents/[documentId]/download/route";
import {GET as formFields} from "@/app/api/studio/documents/[documentId]/form-fields/route";
import {GET as versions, POST as restore} from "@/app/api/studio/documents/[documentId]/versions/route";
import {GET as versionPreview} from "@/app/api/studio/documents/[documentId]/versions/[versionId]/preview/route";
import {GET as versionDownload} from "@/app/api/studio/documents/[documentId]/versions/[versionId]/download/route";
import {POST as processDocument} from "@/app/api/jobs/route";
import {fixtureBytes, pollJob} from "./helpers";

vi.mock("@/lib/auth/server", () => ({getCurrentUser: vi.fn()}));
const owner = "aaaaaaaa-1111-4111-8111-111111111111";
const outsider = "bbbbbbbb-2222-4222-8222-222222222222";
const guest = "cccccccc-3333-4333-8333-333333333333";
const savedIds: string[] = [];
function req(body?: unknown, method?: string) {
  return new Request("http://localhost/api", {
    method: method ?? (body ? "POST" : "GET"),
    headers: {origin: "http://localhost", cookie: `foliant_guest_session=${guest}`, "content-type": "application/json"},
    body: body ? JSON.stringify(body) : undefined
  });
}

afterAll(async () => { for (const id of savedIds) await deleteWorkspaceDocument(id, owner); });

describe("durable document ownership", () => {
  it("gates every route by the verified user, including versions and tool sources", async () => {
    const bytes = fixtureBytes("light.pdf");
    const file = createTemporaryFile({fileName: "owned.pdf", fileSize: bytes.length, mimeType: "application/pdf", tool: "rotate_pdf", maxSize: 10000000, guestSessionId: guest});
    await saveTemporaryFile(file.id, new Uint8Array(bytes).buffer);
    const job = createJob({tool: "rotate_pdf", fileIds: [file.id], options: {rotateDegrees: 90}, guestSessionId: guest});
    await pollJob(job.id);
    const document = (await saveJobResultToWorkspace(job.id, owner))!;
    savedIds.push(document.id);
    const history = await listWorkspaceDocumentVersions(document.id, owner);
    const params = {params: Promise.resolve({documentId: document.id})};
    const versionParams = {params: Promise.resolve({documentId: document.id, versionId: history[0].id})};

    for (const user of [null, {id: outsider, email: "other@example.test"}]) {
      vi.mocked(getCurrentUser).mockResolvedValue(user);
      for (const route of [detail, preview, download, formFields]) expect((await route(req(), params)).status).toBe(404);
      for (const route of [versionPreview, versionDownload]) expect((await route(req(), versionParams)).status).toBe(404);
      expect((await (await versions(req(), params)).json()).versions).toEqual([]);
      expect((await (await list(req())).json()).documents.some((item: {id: string}) => item.id === document.id)).toBe(false);
      expect((await remove(req(undefined, "DELETE"), params)).status).toBe(user ? 404 : 401);
      expect((await restore(req({versionId: history[0].id}), params)).status).toBe(user ? 404 : 401);
      expect((await save(req({documentId: document.id, jobId: job.id}))).status).toBe(user ? 404 : 401);
      expect((await processDocument(req({tool: "rotate_pdf", workspaceDocumentId: document.id, options: {rotateDegrees: 90}}))).status).toBe(404);
    }

    vi.mocked(getCurrentUser).mockResolvedValue({id: owner, email: "owner@example.test"});
    for (const route of [detail, preview, download]) expect((await route(req(), params)).status).toBe(200);
    for (const route of [versionPreview, versionDownload]) expect((await route(req(), versionParams)).status).toBe(200);
    expect((await (await list(req())).json()).documents.some((item: {id: string}) => item.id === document.id)).toBe(true);
    expect((await save(new Request("http://localhost/api", {method: "POST", headers: {origin: "https://other.example"}, body: JSON.stringify({jobId: job.id})}))).status).toBe(403);

    // Identity from the body cannot override the verified session.
    const savedResponse = await save(req({jobId: job.id, userId: outsider}));
    expect(savedResponse.status).toBe(200);
    const owned = await savedResponse.json();
    savedIds.push(owned.id);
    expect((await listWorkspaceDocumentVersions(owned.id, owner)).length).toBe(1);
    expect(await listWorkspaceDocumentVersions(owned.id, outsider)).toEqual([]);
  });
});
