import {describe, it, expect, afterAll, vi} from "vitest";
import {POST as initUpload} from "@/app/api/upload/init/route";
import {PUT as putUpload} from "@/app/api/upload/[fileId]/route";
import {POST as createJobRoute} from "@/app/api/jobs/route";
import {GET as getJobRoute} from "@/app/api/jobs/[jobId]/route";
import {GET as downloadRoute} from "@/app/api/jobs/[jobId]/download/route";
import {GET as previewRoute} from "@/app/api/jobs/[jobId]/preview/route";
import {GET as sourcePreviewRoute} from "@/app/api/jobs/[jobId]/source-preview/route";
import {GET as getStudioDocumentsRoute} from "@/app/api/studio/documents/route";
import {POST as saveStudioDocumentRoute} from "@/app/api/studio/documents/route";
import {GET as workspaceDownloadRoute} from "@/app/api/studio/documents/[documentId]/download/route";
import {GET as workspacePreviewRoute} from "@/app/api/studio/documents/[documentId]/preview/route";
import {DELETE as deleteStudioDocumentRoute, GET as getStudioDocumentRoute} from "@/app/api/studio/documents/[documentId]/route";
import {GET as listWorkspaceVersionsRoute, POST as restoreWorkspaceVersionRoute} from "@/app/api/studio/documents/[documentId]/versions/route";
import {GET as workspaceVersionPreviewRoute} from "@/app/api/studio/documents/[documentId]/versions/[versionId]/preview/route";
import {cleanupExpiredFiles} from "@/lib/storage/local";
import {listWorkspaceDocumentVersions} from "@/lib/workspace/documents";
import {ErrorCode} from "@/lib/validation/errors";
import {PDFDocument} from "pdf-lib";
import JSZip from "jszip";
import {createBlankPdfBytes, createDocxBytes, createPptxBytes, createTextPdfBytes, createXlsxBytes, fixtureBytes, isHeicDecoderAvailable, isLibreOfficeAvailable, isQpdfAvailable, pollJob} from "./helpers";

const MB = 1024 * 1024;
const ownerId = "11111111-1111-4111-8111-111111111111";
vi.mock("@/lib/auth/server", () => ({getCurrentUser: async () => ({id: "11111111-1111-4111-8111-111111111111", email: "owner@example.test"})}));

function sessionRequest(url: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("origin", "http://localhost");
  headers.set("cookie", "foliant_guest_session=11111111-1111-4111-8111-111111111111");
  return new Request(url, {...init, headers});
}

function jsonRequest(body: unknown) {
  return sessionRequest("http://localhost/api", {
    method: "POST",
    headers: {"content-type": "application/json"},
    body: JSON.stringify(body)
  });
}

function requestBodyBytes(bytes: Uint8Array) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function twoPagePdf() {
  const source = await PDFDocument.load(fixtureBytes("light.pdf"));
  const output = await PDFDocument.create();
  const pages = await output.copyPages(source, [0, 0]);
  pages.forEach((page) => output.addPage(page));
  return new Uint8Array(await output.save());
}

async function uploadRunAndDownload(input: {tool: string; fileName: string; mimeType: string; bytes: Uint8Array}) {
  const initRes = await initUpload(
    jsonRequest({
      tool: input.tool,
      fileName: input.fileName,
      fileSize: input.bytes.length,
      mimeType: input.mimeType
    })
  );
  expect(initRes.status).toBe(200);
  const init = await initRes.json();

  const putRes = await putUpload(
    sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: requestBodyBytes(input.bytes)}),
    {params: Promise.resolve({fileId: init.fileId})}
  );
  expect(putRes.status).toBe(200);

  const jobRes = await createJobRoute(
    jsonRequest({tool: input.tool, fileIds: [init.fileId]})
  );
  expect(jobRes.status).toBe(200);
  const created = await jobRes.json();

  const finished = await pollJob(created.id);
  expect(finished.status).toBe("completed");

  const downloadRes = await downloadRoute(
    sessionRequest(`http://localhost/api/jobs/${created.id}/download`),
    {params: Promise.resolve({jobId: created.id})}
  );
  expect(downloadRes.status).toBe(200);

  return downloadRes;
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
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
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
      sessionRequest(`http://localhost/api/jobs/${created.id}`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(statusRes.status).toBe(200);
    const status = await statusRes.json();
    expect(status.status).toBe("completed");

    const downloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${created.id}/download`),
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
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
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
        sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
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
      sessionRequest(`http://localhost/api/jobs/${created.id}/download`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/pdf");

    const bytes = new Uint8Array(await downloadRes.arrayBuffer());
    expect(Buffer.from(bytes).subarray(0, 5).toString()).toBe("%PDF-");

    const doc = await PDFDocument.load(Buffer.from(bytes));
    expect(doc.getPageCount()).toBe(2);
  });

  it("exposes completed public jobs as Studio documents", async () => {
    const bytes = fixtureBytes("light.pdf");

    const initRes = await initUpload(
      jsonRequest({tool: "compress_pdf", fileName: "studio-source.pdf", fileSize: bytes.length, mimeType: "application/pdf"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(jsonRequest({tool: "compress_pdf", fileIds: [init.fileId]}));
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();

    const finished = await pollJob(created.id);
    expect(finished.status).toBe("completed");

    const studioRes = await getStudioDocumentsRoute(
      sessionRequest("http://localhost/api/studio/documents?locale=en")
    );
    expect(studioRes.status).toBe(200);
    expect(studioRes.headers.get("cache-control")).toContain("no-store");

    const body = await studioRes.json();
    const document = body.documents.find((item: {id: string}) => item.id === created.id);

    expect(document).toMatchObject({
      id: created.id,
      kind: "compressed",
      owner: "tools",
      status: "completed",
      resultUrl: `/api/jobs/${created.id}/download`,
      previewUrl: `/api/jobs/${created.id}/preview`,
      isLive: true
    });
    expect(document.name).toContain("studio-source");
    expect(document.toolLabel).toBe("compressPdf");

    const previewRes = await previewRoute(
      sessionRequest(`http://localhost/api/jobs/${created.id}/preview`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(previewRes.status).toBe(200);
    expect(previewRes.headers.get("content-type")).toBe("application/pdf");
    expect(previewRes.headers.get("content-disposition")).toContain("inline");
  });

  it("uses the PDF source as Studio preview when the completed result is not a PDF", async () => {
    const bytes = await createTextPdfBytes("Studio source preview for Word");

    const initRes = await initUpload(
      jsonRequest({tool: "pdf_to_word", fileName: "source-preview.pdf", fileSize: bytes.length, mimeType: "application/pdf"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: requestBodyBytes(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(jsonRequest({tool: "pdf_to_word", fileIds: [init.fileId]}));
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();

    const finished = await pollJob(created.id);
    expect(finished.status).toBe("completed");

    const studioRes = await getStudioDocumentsRoute(
      sessionRequest("http://localhost/api/studio/documents?locale=en")
    );
    expect(studioRes.status).toBe(200);

    const body = await studioRes.json();
    const document = body.documents.find((item: {id: string}) => item.id === created.id);

    expect(document).toMatchObject({
      id: created.id,
      resultMimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      sourceMimeType: "application/pdf",
      previewUrl: `/api/jobs/${created.id}/source-preview`
    });

    const previewRes = await sourcePreviewRoute(
      sessionRequest(`http://localhost/api/jobs/${created.id}/source-preview`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(previewRes.status).toBe(200);
    expect(previewRes.headers.get("content-type")).toBe("application/pdf");
    expect(previewRes.headers.get("content-disposition")).toContain("source-preview.pdf");
  });

  it("saves a completed job result as a durable workspace document", async () => {
    const bytes = await createTextPdfBytes("Durable workspace document");

    const initRes = await initUpload(
      jsonRequest({tool: "number_pdf_pages", fileName: "durable-source.pdf", fileSize: bytes.length, mimeType: "application/pdf"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: requestBodyBytes(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(
      jsonRequest({
        tool: "number_pdf_pages",
        fileIds: [init.fileId],
        options: {pageNumberPosition: "bottom_center"}
      })
    );
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();
    const finished = await pollJob(created.id);
    expect(finished.status).toBe("completed");

    const saveRes = await saveStudioDocumentRoute(jsonRequest({jobId: created.id}));
    expect(saveRes.status).toBe(200);
    const saved = await saveRes.json();
    expect(saved.id).toMatch(/^doc_/);

    const studioRes = await getStudioDocumentsRoute(
      sessionRequest("http://localhost/api/studio/documents?locale=en")
    );
    const body = await studioRes.json();
    const document = body.documents.find((item: {id: string}) => item.id === saved.id);

    expect(document).toMatchObject({
      id: saved.id,
      isGuest: false,
      isLive: true,
      resultUrl: `/api/studio/documents/${saved.id}/download`,
      previewUrl: `/api/studio/documents/${saved.id}/preview`,
      status: "completed"
    });

    const previewRes = await workspacePreviewRoute(
      sessionRequest(`http://localhost/api/studio/documents/${saved.id}/preview`),
      {params: Promise.resolve({documentId: saved.id})}
    );
    expect(previewRes.status).toBe(200);
    expect(previewRes.headers.get("content-type")).toBe("application/pdf");

    const detailRes = await getStudioDocumentRoute(
      sessionRequest(`http://localhost/api/studio/documents/${saved.id}?locale=en`),
      {params: Promise.resolve({documentId: saved.id})}
    );
    expect(detailRes.status).toBe(200);
    expect(await detailRes.json()).toMatchObject({
      document: {
        id: saved.id,
        isGuest: false,
        status: "completed"
      }
    });

    const downloadRes = await workspaceDownloadRoute(
      sessionRequest(`http://localhost/api/studio/documents/${saved.id}/download`),
      {params: Promise.resolve({documentId: saved.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-disposition")).toContain("attachment");

    const deleteRes = await deleteStudioDocumentRoute(
      sessionRequest(`http://localhost/api/studio/documents/${saved.id}`, {method: "DELETE"}),
      {params: Promise.resolve({documentId: saved.id})}
    );
    expect(deleteRes.status).toBe(200);
    expect(await deleteRes.json()).toEqual({deleted: true, id: saved.id});

    const deletedDetailRes = await getStudioDocumentRoute(
      sessionRequest(`http://localhost/api/studio/documents/${saved.id}?locale=en`),
      {params: Promise.resolve({documentId: saved.id})}
    );
    expect(deletedDetailRes.status).toBe(404);
  });

  it("creates a follow-up job from a durable workspace document", async () => {
    const bytes = await createTextPdfBytes("Durable workspace source for follow-up");

    const initRes = await initUpload(
      jsonRequest({tool: "number_pdf_pages", fileName: "workspace-follow-up.pdf", fileSize: bytes.length, mimeType: "application/pdf"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: requestBodyBytes(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(
      jsonRequest({
        tool: "number_pdf_pages",
        fileIds: [init.fileId],
        options: {pageNumberPosition: "bottom_center"}
      })
    );
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();
    const finished = await pollJob(created.id);
    expect(finished.status).toBe("completed");

    const saveRes = await saveStudioDocumentRoute(jsonRequest({jobId: created.id}));
    expect(saveRes.status).toBe(200);
    const saved = await saveRes.json();

    const followUpRes = await createJobRoute(
      jsonRequest({
        tool: "rotate_pdf",
        workspaceDocumentId: saved.id,
        options: {rotateDegrees: 90}
      })
    );
    expect(followUpRes.status).toBe(200);
    const followUp = await followUpRes.json();
    const finishedFollowUp = await pollJob(followUp.id);
    expect(finishedFollowUp.status).toBe("completed");

    for (const source of [{workspaceDocumentId: saved.id}, {sourceJobId: created.id, source: "result"}]) {
      const mergeRes = await createJobRoute(jsonRequest({tool: "merge_pdf", ...source, fileIds: [init.fileId]}));
      expect(mergeRes.status).toBe(200);
      const merged = await mergeRes.json();
      expect((await pollJob(merged.id)).status).toBe("completed");
      const mergedDownload = await downloadRoute(sessionRequest(`http://localhost/api/jobs/${merged.id}/download`), {
        params: Promise.resolve({jobId: merged.id})
      });
      expect(mergedDownload.status).toBe(200);
      const mergedPdf = await PDFDocument.load(await mergedDownload.arrayBuffer());
      expect(mergedPdf.getPageCount()).toBe(2);
    }

    const appendRes = await saveStudioDocumentRoute(jsonRequest({
      documentId: saved.id,
      jobId: followUp.id
    }));
    expect(appendRes.status).toBe(200);
    expect(await appendRes.json()).toMatchObject({
      id: saved.id,
      version: 2
    });

    const versions = await listWorkspaceDocumentVersions(saved.id, ownerId);
    expect(versions.map((version) => version.versionNumber)).toEqual([1, 2]);

    const editedDownloadRes = await workspaceDownloadRoute(
      sessionRequest(`http://localhost/api/studio/documents/${saved.id}/download`),
      {params: Promise.resolve({documentId: saved.id})}
    );
    expect(editedDownloadRes.status).toBe(200);
    const editedDoc = await PDFDocument.load(Buffer.from(new Uint8Array(await editedDownloadRes.arrayBuffer())));
    expect(editedDoc.getPage(0).getRotation().angle).toBe(90);

    const versionsRes = await listWorkspaceVersionsRoute(
      sessionRequest(`http://localhost/api/studio/documents/${saved.id}/versions`),
      {params: Promise.resolve({documentId: saved.id})}
    );
    expect(versionsRes.status).toBe(200);
    const versionsBody = await versionsRes.json();
    expect(versionsBody.versions.map((version: {versionNumber: number}) => version.versionNumber)).toEqual([2, 1]);

    const originalVersion = versionsBody.versions.find((version: {versionNumber: number}) => version.versionNumber === 1);
    const versionPreviewRes = await workspaceVersionPreviewRoute(
      sessionRequest(`http://localhost${originalVersion.previewUrl}`),
      {params: Promise.resolve({documentId: saved.id, versionId: originalVersion.id})}
    );
    expect(versionPreviewRes.status).toBe(200);
    expect(versionPreviewRes.headers.get("content-type")).toBe("application/pdf");

    const restoreRes = await restoreWorkspaceVersionRoute(
      jsonRequest({versionId: originalVersion.id}),
      {params: Promise.resolve({documentId: saved.id})}
    );
    expect(restoreRes.status).toBe(200);
    expect(await restoreRes.json()).toMatchObject({id: saved.id, version: 3});

    const restoredVersions = await listWorkspaceDocumentVersions(saved.id, ownerId);
    expect(restoredVersions.map((version) => version.versionNumber)).toEqual([1, 2, 3]);

    const restoredDownloadRes = await workspaceDownloadRoute(
      sessionRequest(`http://localhost/api/studio/documents/${saved.id}/download`),
      {params: Promise.resolve({documentId: saved.id})}
    );
    const restoredDoc = await PDFDocument.load(Buffer.from(new Uint8Array(await restoredDownloadRes.arrayBuffer())));
    expect(restoredDoc.getPage(0).getRotation().angle).toBe(0);

    const deleteRes = await deleteStudioDocumentRoute(
      sessionRequest(`http://localhost/api/studio/documents/${saved.id}`, {method: "DELETE"}),
      {params: Promise.resolve({documentId: saved.id})}
    );
    expect(deleteRes.status).toBe(200);
    expect(await deleteRes.json()).toEqual({deleted: true, id: saved.id});
    expect(await listWorkspaceDocumentVersions(saved.id, ownerId)).toEqual([]);

    const deletedDownloadRes = await workspaceDownloadRoute(
      sessionRequest(`http://localhost/api/studio/documents/${saved.id}/download`),
      {params: Promise.resolve({documentId: saved.id})}
    );
    expect(deletedDownloadRes.status).toBe(404);
  });

  it("creates a follow-up PDF job from a PDF source when the completed result is not a PDF", async () => {
    const bytes = await createTextPdfBytes("Source PDF remains editable after Word conversion");

    const initRes = await initUpload(
      jsonRequest({tool: "pdf_to_word", fileName: "source-editable.pdf", fileSize: bytes.length, mimeType: "application/pdf"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: requestBodyBytes(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const firstJobRes = await createJobRoute(jsonRequest({tool: "pdf_to_word", fileIds: [init.fileId]}));
    expect(firstJobRes.status).toBe(200);
    const firstJob = await firstJobRes.json();
    const finishedFirstJob = await pollJob(firstJob.id);
    expect(finishedFirstJob.status).toBe("completed");

    const followUpRes = await createJobRoute(
      jsonRequest({
        tool: "rotate_pdf",
        sourceJobId: firstJob.id,
        source: "input",
        options: {pageRange: "1", rotateDegrees: 90}
      })
    );
    expect(followUpRes.status).toBe(200);
    const followUpJob = await followUpRes.json();

    const finishedFollowUp = await pollJob(followUpJob.id);
    expect(finishedFollowUp.status).toBe("completed");

    const downloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${followUpJob.id}/download`),
      {params: Promise.resolve({jobId: followUpJob.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/pdf");
  });

  it("creates a follow-up PDF job from a completed source job result", async () => {
    const bytes = fixtureBytes("light.pdf");

    const initRes = await initUpload(
      jsonRequest({tool: "compress_pdf", fileName: "follow-up.pdf", fileSize: bytes.length, mimeType: "application/pdf"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const firstJobRes = await createJobRoute(jsonRequest({tool: "compress_pdf", fileIds: [init.fileId]}));
    expect(firstJobRes.status).toBe(200);
    const firstJob = await firstJobRes.json();
    const finishedFirstJob = await pollJob(firstJob.id);
    expect(finishedFirstJob.status).toBe("completed");

    const followUpRes = await createJobRoute(
      jsonRequest({
        tool: "number_pdf_pages",
        sourceJobId: firstJob.id,
        options: {pageNumberPosition: "bottom_center"}
      })
    );
    expect(followUpRes.status).toBe(200);
    const followUpJob = await followUpRes.json();
    expect(followUpJob.fileIds).toHaveLength(1);
    expect(followUpJob.fileIds[0]).not.toBe(init.fileId);

    const finishedFollowUp = await pollJob(followUpJob.id);
    expect(finishedFollowUp.status).toBe("completed");

    const downloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${followUpJob.id}/download`),
      {params: Promise.resolve({jobId: followUpJob.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/pdf");
  });

  it("applies saved PDF page edits over the HTTP handlers", async () => {
    const bytes = await twoPagePdf();

    const initRes = await initUpload(
      jsonRequest({tool: "reorder_pdf", fileName: "two-pages.pdf", fileSize: bytes.length, mimeType: "application/pdf"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: requestBodyBytes(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(
      jsonRequest({
        tool: "reorder_pdf",
        fileIds: [init.fileId],
        options: {
          pageAnnotations: [
            {
              height: 0.08,
              bold: true,
              fontFamily: "serif",
              fontSize: 18,
              id: "annotation_text_1",
              page: 2,
              text: "Approved",
              textAlign: "center",
              textColor: "#1d4ed8",
              type: "text",
              width: 0.3,
              x: 0.2,
              y: 0.2
            },
            {
              height: 0.08,
              id: "annotation_signature_1",
              page: 2,
              text: "Signature",
              type: "signature",
              width: 0.28,
              x: 0.2,
              y: 0.32
            }
          ],
          pageOrder: [2],
          pageRotations: {"2": 90}
        }
      })
    );
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();

    const finished = await pollJob(created.id);
    expect(finished.status).toBe("completed");

    const downloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${created.id}/download`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/pdf");

    const doc = await PDFDocument.load(Buffer.from(new Uint8Array(await downloadRes.arrayBuffer())));
    expect(doc.getPageCount()).toBe(1);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
  });

  it("keeps a drawn signature when a completed job is saved as a workspace version", async () => {
    const bytes = fixtureBytes("light.pdf");
    const initRes = await initUpload(
      jsonRequest({tool: "reorder_pdf", fileName: "signature-source.pdf", fileSize: bytes.length, mimeType: "application/pdf"})
    );
    const init = await initRes.json();
    await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: requestBodyBytes(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );

    const sourceJobRes = await createJobRoute(jsonRequest({tool: "reorder_pdf", fileIds: [init.fileId]}));
    const sourceJob = await sourceJobRes.json();
    expect((await pollJob(sourceJob.id)).status).toBe("completed");
    const saveSourceRes = await saveStudioDocumentRoute(jsonRequest({jobId: sourceJob.id}));
    const savedSource = await saveSourceRes.json();

    const signJobRes = await createJobRoute(jsonRequest({
      tool: "sign_pdf",
      workspaceDocumentId: savedSource.id,
      options: {
        pageAnnotations: [{
          height: 0.09,
          page: 1,
          signatureColor: "#141412",
          signatureStrokes: [[{x: 0.1, y: 0.65}, {x: 0.5, y: 0.2}, {x: 0.9, y: 0.7}]],
          text: "",
          type: "signature",
          width: 0.28,
          x: 0.3,
          y: 0.35
        }]
      }
    }));
    expect(signJobRes.status).toBe(200);
    const signJob = await signJobRes.json();
    expect((await pollJob(signJob.id)).status).toBe("completed");

    const appendRes = await saveStudioDocumentRoute(jsonRequest({documentId: savedSource.id, jobId: signJob.id}));
    expect(appendRes.status).toBe(200);

    const savedDownload = await workspaceDownloadRoute(
      sessionRequest(`http://localhost/api/studio/documents/${savedSource.id}/download`),
      {params: Promise.resolve({documentId: savedSource.id})}
    );
    const signedPdf = await PDFDocument.load(await savedDownload.arrayBuffer());
    const signedContent = (signedPdf.getPage(0) as any).node.Contents();

    expect(signedContent).toBeTruthy();
    expect((await listWorkspaceDocumentVersions(savedSource.id, ownerId)).length).toBe(2);
  });

  it("inserts uploaded pages into a source job result over the HTTP handlers", async () => {
    const sourceBytes = await twoPagePdf();
    const insertBytes = fixtureBytes("tiny.pdf");

    const sourceInitRes = await initUpload(
      jsonRequest({tool: "number_pdf_pages", fileName: "source.pdf", fileSize: sourceBytes.length, mimeType: "application/pdf"})
    );
    expect(sourceInitRes.status).toBe(200);
    const sourceInit = await sourceInitRes.json();

    const sourcePutRes = await putUpload(
      sessionRequest(`http://localhost${sourceInit.uploadUrl}`, {method: "PUT", body: requestBodyBytes(sourceBytes)}),
      {params: Promise.resolve({fileId: sourceInit.fileId})}
    );
    expect(sourcePutRes.status).toBe(200);

    const sourceJobRes = await createJobRoute(
      jsonRequest({
        tool: "number_pdf_pages",
        fileIds: [sourceInit.fileId],
        options: {pageNumberPosition: "bottom_center"}
      })
    );
    expect(sourceJobRes.status).toBe(200);
    const sourceJob = await sourceJobRes.json();
    const finishedSourceJob = await pollJob(sourceJob.id);
    expect(finishedSourceJob.status).toBe("completed");

    const initRes = await initUpload(
      jsonRequest({tool: "insert_pdf_pages", fileName: "insert.pdf", fileSize: insertBytes.length, mimeType: "application/pdf"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: requestBodyBytes(insertBytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const insertJobRes = await createJobRoute(
      jsonRequest({
        tool: "insert_pdf_pages",
        sourceJobId: sourceJob.id,
        fileIds: [init.fileId],
        options: {insertAfterPage: 1}
      })
    );
    expect(insertJobRes.status).toBe(200);
    const created = await insertJobRes.json();
    const finished = await pollJob(created.id);
    expect(finished.status).toBe("completed");

    const downloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${created.id}/download`),
      {params: Promise.resolve({jobId: created.id})}
    );
    const doc = await PDFDocument.load(Buffer.from(new Uint8Array(await downloadRes.arrayBuffer())));
    expect(doc.getPageCount()).toBe(3);
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
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
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
      sessionRequest(`http://localhost/api/jobs/${created.id}/download`),
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

  it("converts images to PDF end to end over the HTTP handlers", async () => {
    const fileIds: string[] = [];

    for (const name of ["image.jpg", "image.png"]) {
      const bytes = fixtureBytes(name);
      const mimeType = name.endsWith(".png") ? "image/png" : "image/jpeg";

      const initRes = await initUpload(
        jsonRequest({tool: "image_to_pdf", fileName: name, fileSize: bytes.length, mimeType})
      );
      expect(initRes.status).toBe(200);
      const init = await initRes.json();

      const putRes = await putUpload(
        sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
        {params: Promise.resolve({fileId: init.fileId})}
      );
      expect(putRes.status).toBe(200);
      fileIds.push(init.fileId);
    }

    const jobRes = await createJobRoute(jsonRequest({tool: "image_to_pdf", fileIds}));
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();

    const finished = await pollJob(created.id);
    expect(finished.status).toBe("completed");

    const downloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${created.id}/download`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/pdf");

    const bytes = new Uint8Array(await downloadRes.arrayBuffer());
    const doc = await PDFDocument.load(Buffer.from(bytes));
    expect(doc.getPageCount()).toBe(2);
  });

  it("converts a PDF to images end to end over the HTTP handlers", async () => {
    const bytes = fixtureBytes("light.pdf");

    const initRes = await initUpload(
      jsonRequest({tool: "pdf_to_image", fileName: "light.pdf", fileSize: bytes.length, mimeType: "application/pdf"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(
      jsonRequest({tool: "pdf_to_image", fileIds: [init.fileId], options: {pdfToImageFormat: "jpg"}})
    );
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();

    const finished = await pollJob(created.id);
    expect(finished.status).toBe("completed");

    const downloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${created.id}/download`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/zip");

    const zip = await JSZip.loadAsync(await downloadRes.arrayBuffer());
    expect(zip.file("page-001.jpg")).toBeTruthy();
  });

  it("converts a selectable-text PDF to Word end to end over the HTTP handlers", async () => {
    const bytes = await createTextPdfBytes("API PDF to Word conversion");

    const initRes = await initUpload(
      jsonRequest({tool: "pdf_to_word", fileName: "source.pdf", fileSize: bytes.length, mimeType: "application/pdf"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(
      jsonRequest({tool: "pdf_to_word", fileIds: [init.fileId]})
    );
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();

    const finished = await pollJob(created.id);
    expect(finished.status).toBe("completed");

    const downloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${created.id}/download`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");

    const zip = await JSZip.loadAsync(await downloadRes.arrayBuffer());
    const xml = await zip.file("word/document.xml")?.async("string");
    expect(xml).toContain("API PDF to Word conversion");
  });

  it("converts a selectable-text PDF to Excel end to end over the HTTP handlers", async () => {
    const downloadRes = await uploadRunAndDownload({
      tool: "pdf_to_excel",
      fileName: "source.pdf",
      mimeType: "application/pdf",
      bytes: new Uint8Array(await createTextPdfBytes("Vendor  Amount\nAirtel  42300"))
    });

    expect(downloadRes.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    const zip = await JSZip.loadAsync(await downloadRes.arrayBuffer());
    const xml = await zip.file("xl/worksheets/sheet1.xml")?.async("string");
    expect(xml).toContain("Vendor");
    expect(xml).toContain("Airtel");
  });

  it("converts a selectable-text PDF to PowerPoint end to end over the HTTP handlers", async () => {
    const downloadRes = await uploadRunAndDownload({
      tool: "pdf_to_powerpoint",
      fileName: "source.pdf",
      mimeType: "application/pdf",
      bytes: new Uint8Array(await createTextPdfBytes("API PDF to PowerPoint conversion"))
    });

    expect(downloadRes.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.presentationml.presentation");

    const zip = await JSZip.loadAsync(await downloadRes.arrayBuffer());
    const xml = await zip.file("ppt/slides/slide1.xml")?.async("string");
    expect(xml).toContain("API PDF to PowerPoint conversion");
  });

  it("fails PDF to Word cleanly when OCR is required", async () => {
    const bytes = await createBlankPdfBytes();

    const initRes = await initUpload(
      jsonRequest({tool: "pdf_to_word", fileName: "scan.pdf", fileSize: bytes.length, mimeType: "application/pdf"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(
      jsonRequest({tool: "pdf_to_word", fileIds: [init.fileId]})
    );
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();

    const finished = await pollJob(created.id);
    expect(finished.status).toBe("failed");
    expect(finished.errorCode).toBe(ErrorCode.pdfTextMissing);
  });

  it("rejects a pdf_to_image job with an unsupported format", async () => {
    const initRes = await initUpload(
      jsonRequest({tool: "pdf_to_image", fileName: "light.pdf", fileSize: 1000, mimeType: "application/pdf"})
    );
    const init = await initRes.json();

    const res = await createJobRoute(
      jsonRequest({tool: "pdf_to_image", fileIds: [init.fileId], options: {pdfToImageFormat: "gif"}})
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe(ErrorCode.invalidRequest);
  });

  it("rejects a pdf_to_image job with a resolution outside the supported range", async () => {
    const initRes = await initUpload(
      jsonRequest({tool: "pdf_to_image", fileName: "light.pdf", fileSize: 1000, mimeType: "application/pdf"})
    );
    const init = await initRes.json();

    const res = await createJobRoute(
      jsonRequest({tool: "pdf_to_image", fileIds: [init.fileId], options: {pdfToImageDpi: 600, pdfToImageFormat: "jpg"}})
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe(ErrorCode.invalidRequest);
  });

  it("rotates a PDF end to end over the HTTP handlers", async () => {
    const bytes = fixtureBytes("light.pdf");

    const initRes = await initUpload(
      jsonRequest({tool: "rotate_pdf", fileName: "light.pdf", fileSize: bytes.length, mimeType: "application/pdf"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(
      jsonRequest({tool: "rotate_pdf", fileIds: [init.fileId], options: {rotateDegrees: 90}})
    );
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();

    const finished = await pollJob(created.id);
    expect(finished.status).toBe("completed");

    const downloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${created.id}/download`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/pdf");

    const resultBytes = new Uint8Array(await downloadRes.arrayBuffer());
    const doc = await PDFDocument.load(Buffer.from(resultBytes));
    expect(doc.getPage(0).getRotation().angle).toBe(90);
  });

  it("rotates only the requested PDF page over the HTTP handlers", async () => {
    const bytes = await twoPagePdf();

    const initRes = await initUpload(
      jsonRequest({tool: "rotate_pdf", fileName: "two.pdf", fileSize: bytes.length, mimeType: "application/pdf"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: requestBodyBytes(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(
      jsonRequest({tool: "rotate_pdf", fileIds: [init.fileId], options: {pageRange: "2", rotateDegrees: 90}})
    );
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();

    const finished = await pollJob(created.id);
    expect(finished.status).toBe("completed");

    const downloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${created.id}/download`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(downloadRes.status).toBe(200);

    const doc = await PDFDocument.load(Buffer.from(new Uint8Array(await downloadRes.arrayBuffer())));
    expect(doc.getPage(0).getRotation().angle).toBe(0);
    expect(doc.getPage(1).getRotation().angle).toBe(90);
  });

  it("rejects a rotate job with an invalid angle", async () => {
    const initRes = await initUpload(
      jsonRequest({tool: "rotate_pdf", fileName: "light.pdf", fileSize: 1000, mimeType: "application/pdf"})
    );
    const init = await initRes.json();

    const res = await createJobRoute(
      jsonRequest({tool: "rotate_pdf", fileIds: [init.fileId], options: {rotateDegrees: 45}})
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe(ErrorCode.invalidRequest);
  });

  it("extracts pages end to end over the HTTP handlers", async () => {
    const bytes = await twoPagePdf();

    const initRes = await initUpload(
      jsonRequest({tool: "extract_pdf_pages", fileName: "two.pdf", fileSize: bytes.length, mimeType: "application/pdf"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: bytes}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(
      jsonRequest({tool: "extract_pdf_pages", fileIds: [init.fileId], options: {pageRange: "2"}})
    );
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();

    const finished = await pollJob(created.id);
    expect(finished.status).toBe("completed");

    const downloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${created.id}/download`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/pdf");

    const doc = await PDFDocument.load(Buffer.from(new Uint8Array(await downloadRes.arrayBuffer())));
    expect(doc.getPageCount()).toBe(1);
  });

  it("deletes pages end to end over the HTTP handlers", async () => {
    const bytes = await twoPagePdf();

    const initRes = await initUpload(
      jsonRequest({tool: "delete_pdf_pages", fileName: "two.pdf", fileSize: bytes.length, mimeType: "application/pdf"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: bytes}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(
      jsonRequest({tool: "delete_pdf_pages", fileIds: [init.fileId], options: {pageRange: "1"}})
    );
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();

    const finished = await pollJob(created.id);
    expect(finished.status).toBe("completed");

    const downloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${created.id}/download`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/pdf");

    const doc = await PDFDocument.load(Buffer.from(new Uint8Array(await downloadRes.arrayBuffer())));
    expect(doc.getPageCount()).toBe(1);
  });

  it("rejects an extract job with an empty page range", async () => {
    const initRes = await initUpload(
      jsonRequest({tool: "extract_pdf_pages", fileName: "light.pdf", fileSize: 1000, mimeType: "application/pdf"})
    );
    const init = await initRes.json();

    const res = await createJobRoute(
      jsonRequest({tool: "extract_pdf_pages", fileIds: [init.fileId], options: {pageRange: "  "}})
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe(ErrorCode.invalidRequest);
  });

  it("numbers pages end to end over the HTTP handlers", async () => {
    const bytes = await twoPagePdf();

    const initRes = await initUpload(
      jsonRequest({tool: "number_pdf_pages", fileName: "two.pdf", fileSize: bytes.length, mimeType: "application/pdf"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: bytes}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(
      jsonRequest({tool: "number_pdf_pages", fileIds: [init.fileId], options: {pageNumberPosition: "bottom_center"}})
    );
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();

    const finished = await pollJob(created.id);
    expect(finished.status).toBe("completed");

    const downloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${created.id}/download`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/pdf");

    const doc = await PDFDocument.load(Buffer.from(new Uint8Array(await downloadRes.arrayBuffer())));
    expect(doc.getPageCount()).toBe(2);
  });

  it("rejects a number_pdf_pages job with an unsupported position", async () => {
    const initRes = await initUpload(
      jsonRequest({tool: "number_pdf_pages", fileName: "light.pdf", fileSize: 1000, mimeType: "application/pdf"})
    );
    const init = await initRes.json();

    const res = await createJobRoute(
      jsonRequest({tool: "number_pdf_pages", fileIds: [init.fileId], options: {pageNumberPosition: "side"}})
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe(ErrorCode.invalidRequest);
  });

  it("rejects unsupported visual page number options", async () => {
    const initRes = await initUpload(
      jsonRequest({tool: "number_pdf_pages", fileName: "light.pdf", fileSize: 1000, mimeType: "application/pdf"})
    );
    const init = await initRes.json();

    const res = await createJobRoute(
      jsonRequest({tool: "number_pdf_pages", fileIds: [init.fileId], options: {pageNumberColor: "red"}})
    );

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe(ErrorCode.invalidRequest);
  });

  it("watermarks a PDF end to end over the HTTP handlers", async () => {
    const bytes = fixtureBytes("light.pdf");

    const initRes = await initUpload(
      jsonRequest({tool: "watermark_pdf", fileName: "light.pdf", fileSize: bytes.length, mimeType: "application/pdf"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(
      jsonRequest({tool: "watermark_pdf", fileIds: [init.fileId], options: {watermarkText: "DRAFT", watermarkPosition: "repeated"}})
    );
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();

    const finished = await pollJob(created.id);
    expect(finished.status).toBe("completed");

    const downloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${created.id}/download`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/pdf");

    const doc = await PDFDocument.load(Buffer.from(new Uint8Array(await downloadRes.arrayBuffer())));
    expect(doc.getPageCount()).toBe(1);
  });

  it("rejects a watermark job without text", async () => {
    const initRes = await initUpload(
      jsonRequest({tool: "watermark_pdf", fileName: "light.pdf", fileSize: 1000, mimeType: "application/pdf"})
    );
    const init = await initRes.json();

    const res = await createJobRoute(
      jsonRequest({tool: "watermark_pdf", fileIds: [init.fileId], options: {watermarkPosition: "center"}})
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe(ErrorCode.invalidRequest);
  });

  it("rejects a watermark job with an unsupported position", async () => {
    const initRes = await initUpload(
      jsonRequest({tool: "watermark_pdf", fileName: "light.pdf", fileSize: 1000, mimeType: "application/pdf"})
    );
    const init = await initRes.json();

    const res = await createJobRoute(
      jsonRequest({tool: "watermark_pdf", fileIds: [init.fileId], options: {watermarkText: "DRAFT", watermarkPosition: "corner"}})
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe(ErrorCode.invalidRequest);
  });

  it("rejects a protect job without a password", async () => {
    const initRes = await initUpload(
      jsonRequest({tool: "protect_pdf", fileName: "light.pdf", fileSize: 1000, mimeType: "application/pdf"})
    );
    const init = await initRes.json();

    const res = await createJobRoute(
      jsonRequest({tool: "protect_pdf", fileIds: [init.fileId]})
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe(ErrorCode.invalidRequest);
  });

  it("rejects an unlock job without a password", async () => {
    const initRes = await initUpload(
      jsonRequest({tool: "unlock_pdf", fileName: "light.pdf", fileSize: 1000, mimeType: "application/pdf"})
    );
    const init = await initRes.json();

    const res = await createJobRoute(
      jsonRequest({tool: "unlock_pdf", fileIds: [init.fileId]})
    );
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.code).toBe(ErrorCode.invalidRequest);
  });

  it.skipIf(!isQpdfAvailable())("protects a PDF end to end over the HTTP handlers", async () => {
    const bytes = fixtureBytes("light.pdf");

    const initRes = await initUpload(
      jsonRequest({tool: "protect_pdf", fileName: "light.pdf", fileSize: bytes.length, mimeType: "application/pdf"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(
      jsonRequest({tool: "protect_pdf", fileIds: [init.fileId], options: {pdfPassword: "secret"}})
    );
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();

    const finished = await pollJob(created.id);
    expect(finished.status).toBe("completed");

    const downloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${created.id}/download`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/pdf");

    const resultBytes = Buffer.from(new Uint8Array(await downloadRes.arrayBuffer()));
    await expect(PDFDocument.load(resultBytes)).rejects.toThrow();
  });

  it.skipIf(!isQpdfAvailable())("unlocks a protected PDF end to end over the HTTP handlers", async () => {
    const sourceBytes = fixtureBytes("light.pdf");

    const protectInitRes = await initUpload(
      jsonRequest({tool: "protect_pdf", fileName: "light.pdf", fileSize: sourceBytes.length, mimeType: "application/pdf"})
    );
    expect(protectInitRes.status).toBe(200);
    const protectInit = await protectInitRes.json();

    const protectPutRes = await putUpload(
      sessionRequest(`http://localhost${protectInit.uploadUrl}`, {method: "PUT", body: new Uint8Array(sourceBytes)}),
      {params: Promise.resolve({fileId: protectInit.fileId})}
    );
    expect(protectPutRes.status).toBe(200);

    const protectJobRes = await createJobRoute(
      jsonRequest({tool: "protect_pdf", fileIds: [protectInit.fileId], options: {pdfPassword: "secret"}})
    );
    expect(protectJobRes.status).toBe(200);
    const protectJob = await protectJobRes.json();
    expect((await pollJob(protectJob.id)).status).toBe("completed");

    const protectedDownloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${protectJob.id}/download`),
      {params: Promise.resolve({jobId: protectJob.id})}
    );
    expect(protectedDownloadRes.status).toBe(200);
    const protectedBytes = Buffer.from(new Uint8Array(await protectedDownloadRes.arrayBuffer()));

    const unlockInitRes = await initUpload(
      jsonRequest({tool: "unlock_pdf", fileName: "protected.pdf", fileSize: protectedBytes.length, mimeType: "application/pdf"})
    );
    expect(unlockInitRes.status).toBe(200);
    const unlockInit = await unlockInitRes.json();

    const unlockPutRes = await putUpload(
      sessionRequest(`http://localhost${unlockInit.uploadUrl}`, {method: "PUT", body: new Uint8Array(protectedBytes)}),
      {params: Promise.resolve({fileId: unlockInit.fileId})}
    );
    expect(unlockPutRes.status).toBe(200);

    const unlockJobRes = await createJobRoute(
      jsonRequest({tool: "unlock_pdf", fileIds: [unlockInit.fileId], options: {pdfPassword: "secret"}})
    );
    expect(unlockJobRes.status).toBe(200);
    const unlockJob = await unlockJobRes.json();
    expect((await pollJob(unlockJob.id)).status).toBe("completed");

    const unlockedDownloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${unlockJob.id}/download`),
      {params: Promise.resolve({jobId: unlockJob.id})}
    );
    expect(unlockedDownloadRes.status).toBe(200);
    expect(unlockedDownloadRes.headers.get("content-type")).toBe("application/pdf");

    const doc = await PDFDocument.load(Buffer.from(new Uint8Array(await unlockedDownloadRes.arrayBuffer())));
    expect(doc.getPageCount()).toBe(1);
  });

  it.skipIf(!isHeicDecoderAvailable())("converts HEIC to JPG end to end over the HTTP handlers", async () => {
    const bytes = fixtureBytes("image.heic");

    const initRes = await initUpload(
      jsonRequest({tool: "heic_to_jpg", fileName: "image.heic", fileSize: bytes.length, mimeType: "image/heic"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(
      jsonRequest({tool: "heic_to_jpg", fileIds: [init.fileId]})
    );
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();

    const finished = await pollJob(created.id);
    expect(finished.status).toBe("completed");

    const downloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${created.id}/download`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("image/jpeg");

    const resultBytes = new Uint8Array(await downloadRes.arrayBuffer());
    expect(resultBytes[0]).toBe(0xff);
    expect(resultBytes[1]).toBe(0xd8);
  });

  it("converts Markdown to PDF end to end over the HTTP handlers", async () => {
    const bytes = Buffer.from("# Client Notes\n\n- Upload\n- Convert\n\nReady.");

    const initRes = await initUpload(
      jsonRequest({tool: "markdown_to_pdf", fileName: "notes.md", fileSize: bytes.length, mimeType: "text/markdown"})
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(
      jsonRequest({tool: "markdown_to_pdf", fileIds: [init.fileId]})
    );
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();

    const finished = await pollJob(created.id);
    expect(finished.status).toBe("completed");

    const downloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${created.id}/download`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/pdf");

    const resultBytes = Buffer.from(new Uint8Array(await downloadRes.arrayBuffer()));
    expect(resultBytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(resultBytes)).getPageCount()).toBeGreaterThan(0);
  });

  it.skipIf(!isLibreOfficeAvailable())("converts Word to PDF end to end over the HTTP handlers", async () => {
    const bytes = await createDocxBytes("API Word conversion");

    const initRes = await initUpload(
      jsonRequest({
        tool: "word_to_pdf",
        fileName: "document.docx",
        fileSize: bytes.length,
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      })
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(
      jsonRequest({tool: "word_to_pdf", fileIds: [init.fileId]})
    );
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();

    const finished = await pollJob(created.id, 60_000);
    expect(finished.status).toBe("completed");

    const downloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${created.id}/download`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/pdf");

    const resultBytes = Buffer.from(new Uint8Array(await downloadRes.arrayBuffer()));
    expect(resultBytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(resultBytes)).getPageCount()).toBeGreaterThan(0);
  });

  it.skipIf(!isLibreOfficeAvailable())("converts Excel to PDF end to end over the HTTP handlers", async () => {
    const bytes = await createXlsxBytes("API Excel conversion");

    const initRes = await initUpload(
      jsonRequest({
        tool: "excel_to_pdf",
        fileName: "sheet.xlsx",
        fileSize: bytes.length,
        mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      })
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(
      jsonRequest({tool: "excel_to_pdf", fileIds: [init.fileId]})
    );
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();

    const finished = await pollJob(created.id, 60_000);
    expect(finished.status).toBe("completed");

    const downloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${created.id}/download`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/pdf");

    const resultBytes = Buffer.from(new Uint8Array(await downloadRes.arrayBuffer()));
    expect(resultBytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(resultBytes)).getPageCount()).toBeGreaterThan(0);
  });

  it.skipIf(!isLibreOfficeAvailable())("converts PowerPoint to PDF end to end over the HTTP handlers", async () => {
    const bytes = await createPptxBytes("API PowerPoint conversion");

    const initRes = await initUpload(
      jsonRequest({
        tool: "powerpoint_to_pdf",
        fileName: "deck.pptx",
        fileSize: bytes.length,
        mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      })
    );
    expect(initRes.status).toBe(200);
    const init = await initRes.json();

    const putRes = await putUpload(
      sessionRequest(`http://localhost${init.uploadUrl}`, {method: "PUT", body: new Uint8Array(bytes)}),
      {params: Promise.resolve({fileId: init.fileId})}
    );
    expect(putRes.status).toBe(200);

    const jobRes = await createJobRoute(
      jsonRequest({tool: "powerpoint_to_pdf", fileIds: [init.fileId]})
    );
    expect(jobRes.status).toBe(200);
    const created = await jobRes.json();

    const finished = await pollJob(created.id, 60_000);
    expect(finished.status).toBe("completed");

    const downloadRes = await downloadRoute(
      sessionRequest(`http://localhost/api/jobs/${created.id}/download`),
      {params: Promise.resolve({jobId: created.id})}
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("application/pdf");

    const resultBytes = Buffer.from(new Uint8Array(await downloadRes.arrayBuffer()));
    expect(resultBytes.subarray(0, 5).toString()).toBe("%PDF-");
    expect((await PDFDocument.load(resultBytes)).getPageCount()).toBeGreaterThan(0);
  });
});
