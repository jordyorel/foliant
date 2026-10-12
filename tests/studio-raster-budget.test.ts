import {describe, expect, it} from "vitest";
import {pdfPixelRatio} from "@/lib/studio/raster-budget";

describe("PDF raster memory budget", () => {
  it("retains high-density detail at normal zoom", () => {
    expect(pdfPixelRatio(595, 842, 3)).toBe(2);
  });
  it("bounds extreme zoom and landscape pages", () => {
    for (const [width, height] of [[5950, 8420], [20000, 2000], [2000, 20000]]) {
      const ratio = pdfPixelRatio(width, height, 2);
      expect(Math.floor(width * ratio) * Math.floor(height * ratio)).toBeLessThanOrEqual(8_000_000);
      expect(Math.max(Math.floor(width * ratio), Math.floor(height * ratio))).toBeLessThanOrEqual(4096);
    }
  });
  it("handles unavailable density and invalid dimensions", () => {
    expect(pdfPixelRatio(595, 842, NaN)).toBe(1);
    expect(pdfPixelRatio(0, 0, 2)).toBe(1);
  });
});
