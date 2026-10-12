import {describe, expect, it} from "vitest";
import {tools} from "@/content/tools";
import {getToolAction} from "@/content/tools/actions";
import {getToolEditorial, toolDescriptions, marketingCopy, localize} from "@/content/tools/editorial";
import {maxUploadBytes} from "@/content/tools/upload-limits";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import {formatSize} from "@/components/uploader/upload";

describe("Public redesign coverage", () => {
  it("does not round a small uploaded file down to zero megabytes", () => {
    expect(formatSize(0)).toBe("0 B");
    expect(formatSize(2800)).toBe("2.7 KB");
    expect(formatSize(1024 * 1024)).toBe("1.0 MB");
  });
  it("covers every public tool and no deferred tools", () => {
    expect(Object.keys(toolDescriptions).sort()).toEqual(Object.keys(tools).sort());
  });
  for (const locale of ["fr", "en", "es", "pt"]) {
    it(`provides unique metadata and valid related links in ${locale}`, () => {
      const descriptions = new Set<string>();
      for (const slug of Object.keys(tools)) {
        const content = getToolEditorial(slug, locale);
        expect(content.description.length).toBeGreaterThan(50);
        expect(content.quality.length).toBeGreaterThan(50);
        expect(content.qualityQuestion.length).toBeGreaterThan(15);
        expect(content.preparation.length).toBeGreaterThan(20);
        expect(content.preparation).not.toBe(content.description);
        expect(content.formats).not.toContain("undefined");
        expect(content.formats).not.toContain("APPLICATION/");
        expect(content.limitMB * 1024 * 1024).toBe(maxUploadBytes(getToolAction(slug)));
        expect(content.related).not.toContain(slug);
        for (const link of content.related) expect(tools[link]).toBeDefined();
        descriptions.add(content.description);
      }
      expect(descriptions.size).toBe(Object.keys(tools).length);
      for (const copy of Object.values(marketingCopy)) expect(localize(copy, locale).length).toBeGreaterThan(3);
    });
  }
  it("keeps the sitemap public and lets crawlers load rendering assets", () => {
    const map = sitemap();
    expect(map).toHaveLength((Object.keys(tools).length + 1) * 4);
    expect(map.some((entry) => entry.url.includes("/studio"))).toBe(false);
    const rules = robots().rules;
    expect(Array.isArray(rules)).toBe(false);
    const disallow = (rules as {disallow: string[]}).disallow;
    expect(disallow).not.toContain("/_next/");
    for (const locale of ["fr", "en", "es", "pt"]) expect(disallow).toContain(`/${locale}/studio`);
  });
});
