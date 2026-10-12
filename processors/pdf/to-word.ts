import {writeFile} from "node:fs/promises";
import JSZip from "jszip";
import {AppError, ErrorCode} from "@/lib/validation/errors";
import {extractSelectablePdfText} from "./text";

function escapeXml(text: string) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function writeDocx(text: string, outputPath: string) {
  const zip = new JSZip();
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => {
      const runs = paragraph
        .split(/\n/)
        .map((line, index) => `${index > 0 ? "<w:br/>" : ""}<w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r>`)
        .join("");
      return `<w:p>${runs}</w:p>`;
    })
    .join("");

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.file("word/document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    ${paragraphs}
    <w:sectPr>
      <w:pgSz w:w="12240" w:h="15840"/>
      <w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`);

  await writeFile(outputPath, await zip.generateAsync({type: "nodebuffer"}));
}

export async function pdfToWord(inputPath: string, outputPath: string) {
  let text = "";

  try {
    text = await extractSelectablePdfText(inputPath);
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error instanceof Error ? error.message : "Unknown PDF text extraction error";
    throw new AppError(ErrorCode.processingFailed, `PDF to Word conversion failed: ${message}`, 422);
  }

  if (!text) {
    throw new AppError(
      ErrorCode.pdfTextMissing,
      "This PDF does not contain selectable text. OCR is required for scanned PDFs.",
      422
    );
  }

  await writeDocx(text, outputPath);
  return outputPath;
}
