import {readFile} from "node:fs/promises";
import {inflateSync} from "node:zlib";
import {PDFDocument} from "pdf-lib";

type PdfObjectLike = {
  asArray?: () => unknown[];
  Contents: () => PdfObjectLike | unknown;
};

type PdfStreamLike = {
  getContents?: () => Uint8Array;
  getContentsString?: () => string;
};

function normalizeText(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHexString(hex: string) {
  const normalized = hex.replace(/\s+/g, "");
  const bytes: number[] = [];

  for (let index = 0; index < normalized.length; index += 2) {
    const value = Number.parseInt(normalized.slice(index, index + 2).padEnd(2, "0"), 16);
    if (Number.isFinite(value)) bytes.push(value);
  }

  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    let decoded = "";
    for (let index = 2; index + 1 < bytes.length; index += 2) {
      decoded += String.fromCharCode((bytes[index] << 8) | bytes[index + 1]);
    }
    return decoded;
  }

  return Buffer.from(bytes).toString("latin1");
}

function decodeLiteralString(value: string) {
  let decoded = "";

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char !== "\\") {
      decoded += char;
      continue;
    }

    const next = value[index + 1];
    index += 1;

    switch (next) {
      case "n":
        decoded += "\n";
        break;
      case "r":
        decoded += "\r";
        break;
      case "t":
        decoded += "\t";
        break;
      case "b":
        decoded += "\b";
        break;
      case "f":
        decoded += "\f";
        break;
      case "(":
      case ")":
      case "\\":
        decoded += next;
        break;
      case "\n":
      case "\r":
        break;
      default:
        if (next && /[0-7]/.test(next)) {
          let octal = next;
          while (index + 1 < value.length && octal.length < 3 && /[0-7]/.test(value[index + 1])) {
            index += 1;
            octal += value[index];
          }
          decoded += String.fromCharCode(Number.parseInt(octal, 8));
        } else if (next) {
          decoded += next;
        }
    }
  }

  return decoded;
}

function extractStringsFromTextArray(value: string) {
  const pieces: string[] = [];
  const tokenPattern = /<([0-9A-Fa-f\s]+)>|\(((?:\\.|[^\\)])*)\)/g;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(value))) {
    pieces.push(match[1] ? decodeHexString(match[1]) : decodeLiteralString(match[2]));
  }

  return pieces.join("");
}

function decodeStream(stream: PdfStreamLike) {
  const raw = stream.getContents?.();

  if (raw) {
    try {
      return inflateSync(Buffer.from(raw)).toString("latin1");
    } catch {
      return Buffer.from(raw).toString("latin1");
    }
  }

  return stream.getContentsString?.() ?? "";
}

function extractTextFromContent(content: string) {
  const pieces: string[] = [];
  const tokenPattern = /<([0-9A-Fa-f\s]+)>\s*Tj|\(((?:\\.|[^\\)])*)\)\s*Tj|\[([\s\S]*?)\]\s*TJ|T\*|\bTd\b|\bTD\b|\bET\b/g;
  let match: RegExpExecArray | null;

  while ((match = tokenPattern.exec(content))) {
    if (match[1]) {
      pieces.push(decodeHexString(match[1]));
    } else if (match[2]) {
      pieces.push(decodeLiteralString(match[2]));
    } else if (match[3]) {
      pieces.push(extractStringsFromTextArray(match[3]));
    } else {
      pieces.push("\n");
    }
  }

  return pieces.join(" ");
}

function pageContent(doc: PDFDocument, index: number) {
  const contents = (doc.getPage(index) as unknown as {node: PdfObjectLike}).node.Contents();
  const contentObject = contents as PdfObjectLike | unknown;
  const items = contentObject && typeof (contentObject as PdfObjectLike).asArray === "function"
    ? (contentObject as PdfObjectLike).asArray!()
    : contentObject;
  const streams = Array.isArray(items) ? items : [items];

  return streams
    .map((ref) => (doc as unknown as {context: {lookup: (ref: unknown) => PdfStreamLike}}).context.lookup(ref))
    .filter(Boolean)
    .map((stream) => decodeStream(stream))
    .join("\n");
}

export async function extractSelectablePdfPages(inputPath: string) {
  const bytes = await readFile(inputPath);
  const doc = await PDFDocument.load(bytes, {ignoreEncryption: true});

  return Array.from({length: doc.getPageCount()}, (_, index) => {
    const text = extractTextFromContent(pageContent(doc, index));
    return normalizeText(text);
  });
}

export async function extractSelectablePdfText(inputPath: string) {
  const pages = await extractSelectablePdfPages(inputPath);
  return normalizeText(pages.filter(Boolean).join("\n\n"));
}
