import {afterEach, describe, expect, it, vi} from "vitest";
import {RequestLimiter, limitRequest} from "@/lib/validation/rate-limit";
import {readLimitedBody} from "@/lib/validation/body";
import {logOperationalEvent} from "@/lib/operations/log";
import {tools} from "@/content/tools";
import {catalogSections, fullCatalogSections, homeCategoryHighlights} from "@/content/catalog";
import {isBetaToolAction, isBetaToolSlug} from "@/content/tools/actions";

afterEach(() => vi.restoreAllMocks());

describe("beta safety", () => {
  it("limits repeated requests and releases a bucket after one minute", () => {
    const limiter = new RequestLimiter();
    expect(limiter.consume("a", 2, 100)).toBe(0);
    expect(limiter.consume("a", 2, 100)).toBe(0);
    expect(limiter.consume("a", 2, 100)).toBe(60);
    expect(limiter.consume("b", 2, 100)).toBe(0);
    expect(limiter.consume("a", 2, 60100)).toBe(0);
  });
  it("returns a non-cacheable 429 with Retry-After", () => {
    const request = new Request("http://localhost/api", {headers: {cookie: `foliant_guest_session=${crypto.randomUUID()}`}});
    for (let i = 0; i < 60; i++) expect(limitRequest(request, "job")).toBeNull();
    const response = limitRequest(request, "job")!;
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBeTruthy();
    expect(response.headers.get("cache-control")).toBe("no-store");
  });
  it("checks streamed body size even without content-length", async () => {
    await expect(readLimitedBody(new Request("http://localhost", {method: "POST", body: "123456"}), 5))
      .rejects.toMatchObject({status: 413});
    expect(new TextDecoder().decode(await readLimitedBody(new Request("http://localhost", {method: "POST", body: "12345"}), 5))).toBe("12345");
  });
  it("rejects a declared oversized body before reading it", async () => {
    await expect(readLimitedBody(new Request("http://localhost", {method: "POST", body: "a", headers: {"content-length": "1000"}}), 5))
      .rejects.toMatchObject({status: 413});
  });
  it("logs only allowlisted metadata, never arbitrary private context", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => {});
    logOperationalEvent("job_failed", {tool: "rotate_pdf", code: "processing_failed", durationMs: 12,
      message: "secret", path: "/private/cv.pdf", email: "private@example.com", password: "secret"
    } as Parameters<typeof logOperationalEvent>[1]);
    const payload = JSON.parse(spy.mock.calls[0][0]);
    expect(Object.keys(payload).sort()).toEqual(["code", "durationMs", "event", "timestamp", "tool"]);
    logOperationalEvent("job_failed", {tool: "/private/cv.pdf", code: "secret"});
    expect(spy.mock.calls[1][0]).not.toMatch(/private|secret/);
  });
  it("keeps unfinished tools out of pages while marking them in the full catalogue", () => {
    for (const action of ["ocr_pdf", "image_to_text", "pdf_translator", "document_summarizer"]) {
      expect(isBetaToolAction(action)).toBe(false);
    }
    for (const [slug, action] of [["signer-pdf", "sign_pdf"], ["remplir-pdf", "fill_pdf"]]) {
      expect(tools[slug]).toBeDefined();
      expect(isBetaToolAction(action)).toBe(true);
      expect(fullCatalogSections.flatMap((section) => section.links).find((item) => item.slug === slug)?.available).toBe(true);
    }
    for (const slug of Object.keys(tools)) expect(isBetaToolSlug(slug)).toBe(true);
    for (const section of catalogSections) for (const [slug] of section.links) expect(tools[slug]).toBeDefined();
    for (const section of homeCategoryHighlights) for (const slug of section.links) expect(tools[slug]).toBeDefined();
    for (const section of fullCatalogSections) for (const item of section.links) {
      expect(item.available).toBe(Boolean(tools[item.slug]));
    }
  });
});
