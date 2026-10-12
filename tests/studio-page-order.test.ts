import {describe, expect, it} from "vitest";
import {movePageInOrder} from "@/lib/studio/page-order";

describe("Studio page ordering", () => {
  it("moves a page down by one position", () => {
    expect(movePageInOrder([1, 2, 3], 1, 2)).toEqual([2, 1, 3]);
  });

  it("moves a page down to the end", () => {
    expect(movePageInOrder([1, 2, 3], 1, 3)).toEqual([2, 3, 1]);
  });

  it("moves a page up before its target", () => {
    expect(movePageInOrder([1, 2, 3], 3, 2)).toEqual([1, 3, 2]);
  });
});
