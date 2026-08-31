import {describe, it, expect, afterAll} from "vitest";
import {POST as initUpload} from "@/app/api/upload/init/route";
import {PUT as putUpload} from "@/app/api/upload/[fileId]/route";
import {POST as createJobRoute} from "@/app/api/jobs/route";
import {GET as getJobRoute} from "@/app/api/jobs/[jobId]/route";
import {GET as downloadRoute} from "@/app/api/jobs/[jobId]/download/route";
import {cleanupExpiredFiles} from "@/lib/storage/local";
import {ErrorCode} from "@/lib/validation/errors";
import {PDFDocument} from "pdf-lib";
import JSZip from "jszip";
import {fixtureBytes, pollJob} from "./helpers";

const MB = 1024 * 1024;

function jsonRequest(body: unknown) {
  return new Request("http://localhost/api", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(body)
  });
}

describe("upload → job → download API flow", () => {
  afterAll(async () => {
    await cleanupExpiredFiles(Date.now() + 1_000_000_000);
  });

  it("processes a PDF end to end over the HTTP handlers", async () => {
    const bytes = fixtureBytes("light.pdf");

    const initRes = await initUpload(
      jsonRequest({tool: "compress_pdf", fileName: "light.pdf", fileSize: bytes.length, mimeType: "application/pdf"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();
    expect(init.fileId).toBeTruthy();
    expect(init.uploadUrl).toBe(`/api/upload/${init.fileId}`);

    const putRes = await putUpload(
      new Request(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(jsonRequest({tool: "compress_pdf", fileIds: [init.fileId]}));
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();
    expect(created.id).toBeTruthy();
    expect(created.status).toBe("queued");

    const finished = await pollJob(created.id);
    expect(finished.status).toBe("completed");

    const statusRes = await getJobRoute(
      new Request(`http://localhost/api/jobs/${created.id}`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(statusRes.status).toBe(200);
    const status = await statusRes.json();
    expect(status.status).toBe("completed");

    const downloadRes = await downloadRoute(
      new Request(`http://localhost/api/jobs/${created.id}/download`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/pdf");

    const resultBytes = new Uint8Array(await downloadRes.arrayBuffer());
    expect(Buffer.from(resultBytes).subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("returns a clear too-large error from init", async () => {
    const res = await initUpload(
      jsonRequest({tool: "compress_pdf", fileName: "a.pdf", fileSize: 26 * MB, mimeType: "application/pdf"})
    );
    expect(res.status).toBe(413);

    const body = await res.json();
    expect(body.code).toBe(ErrorCode.fileTooLarge);
  });

  it("returns a clear unsupported-type error from init", async () => {
    const res = await initUpload(
      jsonRequest({tool: "compress_pdf", fileName: "a.txt", fileSize: 1000, mimeType: "text/plain"})
    );
    expect(res.status).toBe(415);

    const body = await res.json();
    expect(body.code).toBe(ErrorCode.unsupportedType);
  });

  it("returns a clear invalid-file error from upload", async () => {
    const initRes = await initUpload(
      jsonRequest({tool: "compress_pdf", fileName: "bad.pdf", fileSize: 1000, mimeType: "application/pdf"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const bytes = fixtureBytes("invalid.pdf");
    const res = await putUpload(
      new Request(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(res.status).toBe(415);

    const body = await res.json();
    expect(body.code).toBe(ErrorCode.invalidFile);
  });

  it("merges two PDFs end to end over the HTTP handlers", async () => {
    const fileIds: string[] = [];

    for (const name of ["light.pdf", "heavy.pdf"]) {
      const bytes = fixtureBytes(name);
      const initRes = await initUpload(
        jsonRequest({tool: "merge_pdf", fileName: name, fileSize: bytes.length, mimeType: "application/pdf"})
      );
      expect(initRes.status).toBe(200);
      const init = await initRes.json();

      const putRes = await putUpload(
        new Request(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
        {params: Promise.resolve({fileId: init.fileId})}
      );
      expect(putRes.status).toBe(200);
      fileIds.push(init.fileId);
    }

    const jobRes = await createJobRoute(jsonRequest({tool: "merge_pdf", fileIds}));
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();

    const finished = await pollJob(created.id);
    expect(finished.status).toBe("completed");

    const downloadRes = await downloadRoute(
      new Request(`http://localhost/api/jobs/${created.id}/download`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/pdf");

    const bytes = new Uint8Array(await downloadRes.arrayBuffer());
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");

    const doc = await PDFDocument.load(Buffer.from(bytes));
    expect(doc.getPageCount()).toBe(2);
  });

  it("rejects a merge job with fewer than two files", async () => {
    const initRes = await initUpload(
      jsonRequest({tool: "merge_pdf", fileName: "light.pdf", fileSize: 1000, mimeType: "application/pdf"})
    );
    const init = await initRes.json();

    const res = await createJobRoute(jsonRequest({tool: "merge_pdf", fileIds: [init.fileId]}));
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe(ErrorCode.invalidRequest);
  });

  it("splits a PDF end to end over the HTTP handlers", async () => {
    const bytes = fixtureBytes("light.pdf");

    const initRes = await initUpload(
      jsonRequest({tool: "split_pdf", fileName: "light.pdf", fileSize: bytes.length, mimeType: "application/pdf"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      new Request(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(
      jsonRequest({tool: "split_pdf", fileIds: [init.fileId], options: {splitMode: "every_page"}})
    );
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();

    const finished = await pollJob(created.id);
    expect(finished.status).toBe("completed");

    const downloadRes = await downloadRoute(
      new Request(`http://localhost/api/jobs/${created.id}/download`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/zip");

    const zip = await JSZip.loadAsync(await downloadRes.arrayBuffer());
    expect(zip.file("page-001.pdf")).toBeTruthy();
  });

  it("rejects a split job with an empty typed page range", async () => {
    const initRes = await initUpload(
      jsonRequest({tool: "split_pdf", fileName: "light.pdf", fileSize: 1000, mimeType: "application/pdf"})
    );
    const init = await initRes.json();

    const res = await createJobRoute(
      jsonRequest({tool: "split_pdf", fileIds: [init.fileId], options: {splitMode: "range"}})
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe(ErrorCode.invalidRequest);
  });
});
