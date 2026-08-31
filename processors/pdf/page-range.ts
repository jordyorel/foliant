import {AppError, ErrorCode} from "@/lib/validation/errors";

function assertPage(page: number, pageCount: number) {
  if (!Number.isInteger(page) || page < 1 || page > pageCount) {
    throw new AppError(ErrorCode.invalidRequest, "Page range is outside the PDF page count.", 400);
  }
}

/**
 * Parses a comma-separated page range like "1-3, 2, 5" into an ordered,
 * de-duplicated list of 1-based page numbers. Used by split, extract and
 * delete tools so the range syntax stays identical everywhere.
 */
export function parsePageRange(input: string, pageCount: number) {
  const pages: number[] = [];
  const seen = new Set<number>();

  for (const rawPart of input.split(",")) {
    const part = rawPart.trim();
    if (!part) continue;

    const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
    const singleMatch = part.match(/^\d+$/);

    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (end < start) {
        throw new AppError(ErrorCode.invalidRequest, "Page range end must be after the start.", 400);
      }
      assertPage(start, pageCount);
      assertPage(end, pageCount);

      for (let page = start; page <= end; page += 1) {
        if (!seen.has(page)) {
          pages.push(page);
          seen.add(page);
        }
      }
    } else if (singleMatch) {
      const page = Number(part);
      assertPage(page, pageCount);
      if (!seen.has(page)) {
        pages.push(page);
        seen.add(page);
      }
    } else {
      throw new AppError(ErrorCode.invalidRequest, "Page range format is invalid.", 400);
    }
  }

  if (pages.length === 0) {
    throw new AppError(ErrorCode.invalidRequest, "At least one page must be selected.", 400);
  }

  return pages;
}
