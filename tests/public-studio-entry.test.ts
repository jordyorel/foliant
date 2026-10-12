import {describe, expect, it} from "vitest";
import {guestStudioDocumentUrl} from "@/components/uploader/guestStudio";

describe("public Studio entry", () => {
  it("preserves the locale and opens the requested form or signature tool", () => {
    for (const locale of ["fr", "en", "es", "pt"]) {
      for (const tool of ["fill_pdf", "sign_pdf"]) {
        expect(guestStudioDocumentUrl("job_test", `/${locale}/signer-pdf`, tool))
          .toBe(`/${locale}/studio/documents/job_test?entry=guest&tool=${tool}`);
      }
    }
  });

  it("keeps other entries unchanged and does not accept arbitrary intent", () => {
    expect(guestStudioDocumentUrl("job/test", "/unknown", "ocr_pdf"))
      .toBe("/fr/studio/documents/job%2Ftest?entry=guest");
    expect(guestStudioDocumentUrl("job_test", "/en/compresser-pdf"))
      .toBe("/en/studio/documents/job_test?entry=guest");
  });
});
