import {readFile, writeFile} from "node:fs/promises";
import {basename} from "node:path";
import {PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage} from "pdf-lib";
import {AppError, ErrorCode} from "@/lib/validation/errors";

type MarkdownBlockType = "h1" | "h2" | "h3" | "paragraph" | "list" | "quote" | "code" | "space";

type MarkdownBlock = {
  type: MarkdownBlockType;
  text: string;
};

type RendererState = {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
};

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 56;
const contentWidth = pageWidth - margin * 2;

function sanitizeText(text: string) {
  return text
    .replace(/\t/g, "    ")
    .replace(/[^\n\r\x20-\x7E\u00A0-\u00FF]/g, "?");
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let paragraph: string[] = [];
  let code: string[] = [];
  let inCode = false;

  function flushParagraph() {
    if (!paragraph.length) return;
    blocks.push({type: "paragraph", text: paragraph.join(" ")});
    paragraph = [];
  }

  function flushCode() {
    if (!code.length) return;
    blocks.push({type: "code", text: code.join("\n")});
    code = [];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      if (inCode) {
        flushCode();
        inCode = false;
      } else {
        flushParagraph();
        inCode = true;
      }
      continue;
    }

    if (inCode) {
      code.push(line);
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      blocks.push({type: "space", text: ""});
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: heading[1].length === 1 ? "h1" : heading[1].length === 2 ? "h2" : "h3",
        text: heading[2]
      });
      continue;
    }

    const listItem = /^([-*+]|\d+\.)\s+(.+)$/.exec(trimmed);
    if (listItem) {
      flushParagraph();
      blocks.push({type: "list", text: listItem[2]});
      continue;
    }

    if (trimmed.startsWith(">")) {
      flushParagraph();
      blocks.push({type: "quote", text: trimmed.replace(/^>\s?/, "")});
      continue;
    }

    paragraph.push(trimmed);
  }

  flushParagraph();
  flushCode();
  return blocks;
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const lines: string[] = [];
  const words = sanitizeText(text).split(/\s+/).filter(Boolean);
  let current = "";

  function pushLongWord(word: string) {
    let segment = "";
    for (const char of word) {
      const next = `${segment}${char}`;
      if (segment && font.widthOfTextAtSize(next, fontSize) > maxWidth) {
        lines.push(segment);
        segment = char;
      } else {
        segment = next;
      }
    }
    current = segment;
  }

  for (const word of words) {
    if (!current) {
      if (font.widthOfTextAtSize(word, fontSize) > maxWidth) pushLongWord(word);
      else current = word;
      continue;
    }

    const next = `${current} ${word}`;
    if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) {
      current = next;
      continue;
    }

    lines.push(current);
    if (font.widthOfTextAtSize(word, fontSize) > maxWidth) pushLongWord(word);
    else current = word;
  }

  if (current) lines.push(current);
  return lines.length ? lines : [""];
}

function addPage(state: RendererState) {
  state.page = state.doc.addPage([pageWidth, pageHeight]);
  state.y = pageHeight - margin;
}

function ensureSpace(state: RendererState, requiredHeight: number) {
  if (state.y - requiredHeight < margin) addPage(state);
}

function drawLines(
  state: RendererState,
  lines: string[],
  font: PDFFont,
  fontSize: number,
  lineHeight: number,
  x: number,
  color = rgb(0.08, 0.08, 0.07)
) {
  for (const line of lines) {
    ensureSpace(state, lineHeight);
    state.page.drawText(line, {x, y: state.y - fontSize, size: fontSize, font, color});
    state.y -= lineHeight;
  }
}

export async function markdownToPdf(inputPath: string, outputPath: string) {
  try {
    const markdown = await readFile(inputPath, "utf8");
    const doc = await PDFDocument.create();
    const regular = await doc.embedFont(StandardFonts.Helvetica);
    const bold = await doc.embedFont(StandardFonts.HelveticaBold);
    const italic = await doc.embedFont(StandardFonts.HelveticaOblique);
    const mono = await doc.embedFont(StandardFonts.Courier);
    const state: RendererState = {doc, page: doc.addPage([pageWidth, pageHeight]), y: pageHeight - margin};
    const title = basename(inputPath).replace(/\.(md|markdown)$/i, "");

    if (title) {
      drawLines(state, wrapText(title, bold, 11, contentWidth), bold, 11, 18, margin, rgb(0.42, 0.42, 0.39));
      state.y -= 16;
    }

    for (const block of parseMarkdown(markdown)) {
      if (block.type === "space") {
        state.y -= 8;
        continue;
      }

      if (block.type === "h1") {
        state.y -= 8;
        const lines = wrapText(block.text, bold, 26, contentWidth);
        drawLines(state, lines, bold, 26, 34, margin);
        state.y -= 10;
        continue;
      }

      if (block.type === "h2") {
        state.y -= 10;
        const lines = wrapText(block.text, bold, 20, contentWidth);
        drawLines(state, lines, bold, 20, 28, margin);
        state.y -= 6;
        continue;
      }

      if (block.type === "h3") {
        state.y -= 8;
        const lines = wrapText(block.text, bold, 15, contentWidth);
        drawLines(state, lines, bold, 15, 22, margin);
        state.y -= 4;
        continue;
      }

      if (block.type === "list") {
        const lines = wrapText(block.text, regular, 11.5, contentWidth - 22);
        ensureSpace(state, lines.length * 16);
        state.page.drawText("-", {x: margin, y: state.y - 11.5, size: 11.5, font: regular, color: rgb(0.09, 0.45, 0.24)});
        drawLines(state, lines, regular, 11.5, 16, margin + 22);
        state.y -= 3;
        continue;
      }

      if (block.type === "quote") {
        const lines = wrapText(block.text, italic, 11.5, contentWidth - 22);
        ensureSpace(state, lines.length * 16);
        state.page.drawLine({
          start: {x: margin, y: state.y},
          end: {x: margin, y: state.y - lines.length * 16 + 2},
          thickness: 2,
          color: rgb(0.1, 0.6, 0.31)
        });
        drawLines(state, lines, italic, 11.5, 16, margin + 16, rgb(0.32, 0.32, 0.29));
        state.y -= 6;
        continue;
      }

      if (block.type === "code") {
        const codeLines = block.text.split("\n").flatMap((line) => wrapText(line || " ", mono, 9.5, contentWidth - 24));
        const height = codeLines.length * 14 + 18;
        ensureSpace(state, height);
        state.page.drawRectangle({
          x: margin - 8,
          y: state.y - height + 8,
          width: contentWidth + 16,
          height,
          borderWidth: 0.5,
          borderColor: rgb(0.90, 0.89, 0.86),
          color: rgb(0.98, 0.98, 0.96)
        });
        state.y -= 10;
        drawLines(state, codeLines, mono, 9.5, 14, margin + 4, rgb(0.14, 0.14, 0.12));
        state.y -= 12;
        continue;
      }

      const lines = wrapText(block.text, regular, 11.5, contentWidth);
      drawLines(state, lines, regular, 11.5, 16, margin);
      state.y -= 6;
    }

    await writeFile(outputPath, await doc.save());
    return outputPath;
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error instanceof Error ? error.message : "Unknown Markdown conversion error";
    throw new AppError(ErrorCode.processingFailed, `Markdown to PDF conversion failed: ${message}`, 422);
  }
}
