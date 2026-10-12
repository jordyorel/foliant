import {writeFile} from "node:fs/promises";
import JSZip from "jszip";
import {AppError, ErrorCode} from "@/lib/validation/errors";
import {extractSelectablePdfPages} from "./text";

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function columnName(index: number) {
  let column = "";
  let value = index + 1;

  while (value > 0) {
    const remainder = (value - 1) % 26;
    column = String.fromCharCode(65 + remainder) + column;
    value = Math.floor((value - 1) / 26);
  }

  return column;
}

function splitTextLine(line: string) {
  const columns = line
    .split(/\t+| {2,}/)
    .map((value) => value.trim())
    .filter(Boolean);

  return columns.length > 0 ? columns : [line.trim()];
}

function pagesToRows(pages: string[]) {
  return pages
    .flatMap((page) => page.split(/\n+/))
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => splitTextLine(line));
}

function worksheetXml(rows: string[][]) {
  const sheetRows = rows
    .map((row, rowIndex) => {
      const rowNumber = rowIndex + 1;
      const cells = row
        .map((value, columnIndex) => {
          const ref = `${columnName(columnIndex)}${rowNumber}`;
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
        })
        .join("");

      return `<row r="${rowNumber}">${cells}</row>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>${sheetRows}</sheetData>
</worksheet>`;
}

async function writeXlsx(rows: string[][], outputPath: string) {
  const zip = new JSZip();

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
  zip.file("xl/workbook.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="PDF Text" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`);
  zip.file("xl/_rels/workbook.xml.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
</Relationships>`);
  zip.file("xl/worksheets/sheet1.xml", worksheetXml(rows));

  await writeFile(outputPath, await zip.generateAsync({type: "nodebuffer"}));
}

export async function pdfToExcel(inputPath: string, outputPath: string) {
  let pages: string[] = [];

  try {
    pages = await extractSelectablePdfPages(inputPath);
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error instanceof Error ? error.message : "Unknown PDF text extraction error";
    throw new AppError(ErrorCode.processingFailed, `PDF to Excel conversion failed: ${message}`, 422);
  }

  const rows = pagesToRows(pages);

  if (rows.length === 0) {
    throw new AppError(
      ErrorCode.pdfTextMissing,
      "This PDF does not contain selectable text. OCR is required for scanned PDFs.",
      422
    );
  }

  await writeXlsx(rows, outputPath);
  return outputPath;
}
