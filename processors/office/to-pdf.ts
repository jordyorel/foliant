import {copyFile, mkdir, mkdtemp, readFile, readdir, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {pathToFileURL} from "node:url";
import JSZip from "jszip";
import {AppError, ErrorCode} from "@/lib/validation/errors";
import {runLibreOffice} from "@/processors/lib/libreoffice";

type OfficeKind = "Word" | "Excel" | "PowerPoint";

async function findGeneratedPdf(outputDir: string, inputPath: string) {
  const inputBase = path.basename(inputPath, path.extname(inputPath)).toLowerCase();
  const files = await readdir(outputDir);
  const pdfs = files.filter((file) => file.toLowerCase().endsWith(".pdf"));
  return (
    pdfs.find((file) => path.basename(file, path.extname(file)).toLowerCase() === inputBase) ??
    pdfs[0] ??
    null
  );
}

/**
 * Rewrites a sheet XML so LibreOffice scales the print range to fit all columns
 * on a single page width (landscape). This prevents wide sheets from being
 * split across pages or having columns cut off during PDF export.
 */
function injectFitToPage(xml: string): string {
  let result = xml;

  // 1. Enable "fit to page" mode via sheetPr/pageSetUpPr.
  if (/<pageSetUpPr\b/.test(result)) {
    result = result.replace(/<pageSetUpPr\b[^>]*\/?>/g, `<pageSetUpPr fitToPage="1"/>`);
  } else if (/<sheetPr\b/.test(result)) {
    result = result.replace(/<sheetPr\b([^>]*?)(\/?)>/, (_match, attrs: string, selfClose: string) => {
      return selfClose
        ? `<sheetPr${attrs}><pageSetUpPr fitToPage="1"/></sheetPr>`
        : `<sheetPr${attrs}><pageSetUpPr fitToPage="1"/>`;
    });
  } else {
    result = result.replace(/(<worksheet\b[^>]*>)/, `$1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>`);
  }

  // 2. Fit all columns to one page width, landscape for maximum readability.
  if (/<pageSetup\b/.test(result)) {
    result = result.replace(/<pageSetup\b[^>]*\/?>/g, `<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/>`);
  } else {
    result = result.replace(/<\/worksheet>/, `<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="0"/></worksheet>`);
  }

  return result;
}

async function prepareXlsxForPdf(inputPath: string, workDir: string): Promise<string> {
  if (!inputPath.toLowerCase().endsWith(".xlsx")) return inputPath;

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(await readFile(inputPath));
  } catch {
    return inputPath;
  }

  const sheetNames = Object.keys(zip.files).filter((name) => /^xl\/worksheets\/sheet\d*\.xml$/.test(name));
  if (sheetNames.length === 0) return inputPath;

  let changed = false;
  for (const name of sheetNames) {
    const xml = await zip.files[name].async("string");
    const injected = injectFitToPage(xml);
    if (injected !== xml) {
      zip.file(name, injected);
      changed = true;
    }
  }

  if (!changed) return inputPath;

  const preparedDir = path.join(workDir, "prepared");
  await mkdir(preparedDir, {recursive: true});
  const preparedPath = path.join(preparedDir, path.basename(inputPath));
  await writeFile(preparedPath, await zip.generateAsync({type: "nodebuffer"}));
  return preparedPath;
}

export async function officeToPdf(inputPath: string, outputPath: string, kind: OfficeKind) {
  const workDir = await mkdtemp(path.join(os.tmpdir(), "foliant-office-"));
  const outputDir = path.join(workDir, "out");
  const profileDir = path.join(workDir, "profile");

  try {
    await mkdir(outputDir, {recursive: true});

    const convertInput = kind === "Excel" ? await prepareXlsxForPdf(inputPath, workDir) : inputPath;

    await runLibreOffice([
      `-env:UserInstallation=${pathToFileURL(profileDir).href}`,
      "--headless",
      "--nologo",
      "--nofirststartwizard",
      "--nodefault",
      "--nolockcheck",
      "--norestore",
      "--convert-to",
      "pdf",
      "--outdir",
      outputDir,
      convertInput
    ]);

    const pdfFile = await findGeneratedPdf(outputDir, convertInput);
    if (!pdfFile) {
      throw new AppError(
        ErrorCode.processingFailed,
        `${kind} to PDF conversion did not generate a PDF file.`,
        422
      );
    }

    await copyFile(path.join(outputDir, pdfFile), outputPath);
    return outputPath;
  } catch (error) {
    if (error instanceof AppError) throw error;
    const message = error instanceof Error ? error.message : "Unknown Office conversion error";
    throw new AppError(ErrorCode.processingFailed, `${kind} to PDF conversion failed: ${message}`, 422);
  } finally {
    await rm(workDir, {recursive: true, force: true});
  }
}

export function wordToPdf(inputPath: string, outputPath: string) {
  return officeToPdf(inputPath, outputPath, "Word");
}

export function excelToPdf(inputPath: string, outputPath: string) {
  return officeToPdf(inputPath, outputPath, "Excel");
}

export function powerpointToPdf(inputPath: string, outputPath: string) {
  return officeToPdf(inputPath, outputPath, "PowerPoint");
}
