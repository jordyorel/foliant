import {afterEach, describe, expect, it, vi} from "vitest";
import {uploadFileWithProgress} from "@/components/uploader/upload";
import type {ErrorLabels} from "@/components/uploader/clientError";

class TestRequest {
  static last: TestRequest;
  upload: {onprogress?: (event: {lengthComputable: boolean; loaded: number; total: number}) => void} = {};
  onload?: () => void;
  onloadend?: () => void;
  onabort?: () => void;
  onerror?: () => void;
  ontimeout?: () => void;
  status = 200;
  responseText = "";
  timeout = 0;
  open = vi.fn();
  send = vi.fn();
  abort = vi.fn(() => {this.onabort?.(); this.onloadend?.();});
  constructor() {TestRequest.last = this;}
}
const labels = {error: "Transfer failed"} as ErrorLabels;
const file = new File(["PDF"], "test.pdf", {type: "application/pdf"});
afterEach(() => vi.unstubAllGlobals());

describe("upload transfer lifecycle", () => {
  it("reports measured progress only, and completes at 100", async () => {
    vi.stubGlobal("XMLHttpRequest", TestRequest);
    const progress = vi.fn();
    const result = uploadFileWithProgress("/upload", file, labels, progress);
    const xhr = TestRequest.last;
    xhr.upload.onprogress?.({lengthComputable: false, loaded: 1, total: 0});
    xhr.upload.onprogress?.({lengthComputable: true, loaded: 1, total: 0});
    expect(progress).not.toHaveBeenCalled();
    xhr.upload.onprogress?.({lengthComputable: true, loaded: 3, total: 10});
    expect(progress).toHaveBeenLastCalledWith(30);
    xhr.onload?.(); xhr.onloadend?.();
    await result;
    expect(progress).toHaveBeenLastCalledWith(100);
  });
  it("does not send a request after an earlier abort", async () => {
    vi.stubGlobal("XMLHttpRequest", TestRequest);
    const controller = new AbortController(); controller.abort();
    await expect(uploadFileWithProgress("/upload", file, labels, vi.fn(), controller.signal)).rejects.toMatchObject({name: "AbortError"});
    expect(TestRequest.last.send).not.toHaveBeenCalled();
  });
  it("interrupts an active transfer and removes the abort listener", async () => {
    vi.stubGlobal("XMLHttpRequest", TestRequest);
    const controller = new AbortController();
    const remove = vi.spyOn(controller.signal, "removeEventListener");
    const result = uploadFileWithProgress("/upload", file, labels, vi.fn(), controller.signal);
    controller.abort();
    await expect(result).rejects.toMatchObject({name: "AbortError"});
    expect(TestRequest.last.abort).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledWith("abort", expect.any(Function));
  });
  it("surfaces a timeout without announcing success", async () => {
    vi.stubGlobal("XMLHttpRequest", TestRequest);
    const progress = vi.fn();
    const result = uploadFileWithProgress("/upload", file, labels, progress);
    TestRequest.last.ontimeout?.(); TestRequest.last.onloadend?.();
    await expect(result).rejects.toThrow("Transfer failed");
    expect(progress).not.toHaveBeenCalledWith(100);
  });
});
