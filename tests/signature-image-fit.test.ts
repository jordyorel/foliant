import {describe, expect, it} from "vitest";
import {fitSignatureImage} from "@/processors/pdf/reorder";

describe("signature image proportions", () => {
  it("centres a tall signature without stretching it to fill a wide box", () => {
    expect(fitSignatureImage({width: 100, height: 200}, {width: 300, height: 60})).toEqual({width: 30, height: 60});
  });
  it("fits a wide signature without clipping or distortion", () => {
    expect(fitSignatureImage({width: 600, height: 100}, {width: 300, height: 100})).toEqual({width: 300, height: 50});
  });
});
