import {describe, expect, it} from "vitest";
import {formatAnnotationDate, localToday} from "@/lib/studio/date-annotation";

describe("date annotations", () => {
  it("formats dates for the document language", () => {
    expect(formatAnnotationDate("2026-10-05", "numeric", "fr")).toBe("05/10/2026");
    expect(formatAnnotationDate("2026-10-05", "long", "en")).toBe("October 05, 2026");
    expect(formatAnnotationDate("2026-10-05", "long", "fr")).toBe("05 octobre 2026");
    expect(formatAnnotationDate("2026-10-05", "iso", "pt")).toBe("2026-10-05");
  });
  it("rejects incomplete and impossible dates", () => {
    for (const value of ["", "2026-02-30", "2026-13-01", "05/10/2026", "2026-1-01"]) {
      expect(formatAnnotationDate(value, "numeric", "fr")).toBe("");
    }
    expect(formatAnnotationDate("2024-02-29", "iso", "fr")).toBe("2024-02-29");
  });
  it("uses the local calendar day for the default", () => {
    expect(localToday(new Date(2026, 9, 5, 0, 15))).toBe("2026-10-05");
  });
});
