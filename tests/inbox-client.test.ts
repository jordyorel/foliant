import {afterEach, describe, expect, it, vi} from "vitest";
import {fetchInboxList, inboxErrorKey, InboxClientError, inboxRequest, receiveInboxFile} from "@/lib/studio/inbox-client";

afterEach(() => vi.unstubAllGlobals());

describe("Inbox browser requests", () => {
  it("encodes filenames used for search and preserves the server page and ordering", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({receipts: [], total: 51, offset: 50}));
    vi.stubGlobal("fetch", fetch);
    expect(await fetchInboxList("archived", 50, "a&b #%.pdf", "oldest")).toEqual({receipts: [], total: 51, offset: 50});
    const query = new URL(fetch.mock.calls[0][0], "https://foliant.invalid").searchParams;
    expect(Object.fromEntries(query)).toEqual({status: "archived", offset: "50", search: "a&b #%.pdf", sort: "oldest"});
    expect(fetch.mock.calls[0][1].cache).toBe("no-store");
  });

  it("reuses the deposit key after an uncertain response without changing the original bytes", async () => {
    const fetch = vi.fn().mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce(Response.json({id: "receipt"}, {status: 201}));
    vi.stubGlobal("fetch", fetch);
    const file = new File(["%PDF-original"], "reçu #1.pdf", {type: "application/pdf"});
    await expect(receiveInboxFile(file, "same-deposit")).rejects.toThrow("offline");
    expect(await receiveInboxFile(file, "same-deposit")).toEqual({id: "receipt"});
    for (const [, request] of fetch.mock.calls) {
      expect(request.body).toBe(file);
      expect(request.headers).toEqual({"Content-Type": "application/pdf", "Idempotency-Key": "same-deposit", "X-File-Name": encodeURIComponent(file.name)});
    }
  });

  it("distinguishes quota exhaustion from request throttling", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(Response.json({code: "quota_exceeded"}, {status: 429})).mockResolvedValueOnce(Response.json({code: "rate_limited"}, {status: 429})));
    await expect(inboxRequest("/api/studio/inbox")).rejects.toSatisfy(error => inboxErrorKey(error) === "quota");
    await expect(inboxRequest("/api/studio/inbox")).rejects.toSatisfy(error => inboxErrorKey(error) === "rate");
  });

  it("handles expired sessions and non-JSON service errors without exposing server details", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(new Response("Sign in", {status: 401})).mockResolvedValueOnce(new Response("Internal details", {status: 503})));
    await expect(inboxRequest("/api/studio/inbox")).rejects.toSatisfy(error => inboxErrorKey(error) === "signIn");
    await expect(inboxRequest("/api/studio/inbox")).rejects.toSatisfy(error => inboxErrorKey(error) === "unavailable" && !error.message.includes("Internal details"));
  });

  it("propagates cancellation when changing the account or selected receipt", async () => {
    const abort = new AbortController();
    const fetch = vi.fn().mockImplementation((_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    }));
    vi.stubGlobal("fetch", fetch);
    const pending = fetchInboxList("received", 0, "", "newest", abort.signal);
    abort.abort();
    await expect(pending).rejects.toMatchObject({name: "AbortError"});
    expect(fetch.mock.calls[0][1].signal).toBe(abort.signal);
  });

  it("keeps protected and missing PDFs distinct", () => {
    expect(inboxErrorKey(new InboxClientError("pdf_password_required"))).toBe("protectedText");
    expect(inboxErrorKey(new InboxClientError("not_found"))).toBe("notFound");
  });
});
