import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {mkdtemp, readdir, readFile, rm, writeFile} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import JSZip from "jszip";
import {AppError, ErrorCode} from "@/lib/validation/errors";

const execFileAsync = promisify(execFile);

export type PdfToImageFormat = "jpg" | "png";

export type PdfToImageOptions = {
  format?: PdfToImageFormat;
  dpi?: number;
};

export async function pdfToImage(inputPath: string, outputPath: string, options: PdfToImageOptions = {}) {
  const format: PdfToImageFormat = options.format ?? "jpg";
  const dpi = Math.max(72, Math.min(300, Math.floor(options.dpi ?? 150)));
  const device = format === "png" ? "png16m" : "jpeg";

  const tempDir = await mkdtemp(path.join(os.tmpdir(), "foliant-render-"));
  const pagePattern = path.join(tempDir, `page-%03d.${format}`);

  try {
    await execFileAsync("gs", [
      "-q",
      "-dBATCH",
      "-dNOPAUSE",
      `-sDEVICE=${device}`,
      `-r${dpi}`,
      ...(format === "jpg" ? ["-dJPEGQ=90"] : []),
      `-sOutputFile=${pagePattern}`,
      inputPath
    ]);

    const files = (await readdir(tempDir))
      .filter((name) => name.endsWith(`.${format}`))
      .sort();

    if (files.length === 0) {
      throw new AppError(ErrorCode.processingFailed, "No pages could be rendered.", 422);
    }

    const zip = new JSZip();
    for (const name of files) {
      zip.file(name, await readFile(path.join(tempDir, name)));
    }

    const archive = await zip.generateAsync({type: "nodebuffer", compression: "DEFLATE"});
    await writeFile(outputPath, archive);
    return outputPath;
  } catch (error) {
    if (error instanceof AppError) throw error;

    const message = error instanceof Error ? error.message : "Unknown PDF render error";

    if (message.includes("ENOENT")) {
      throw new AppError(
        ErrorCode.ghostscriptMissing,
        "Ghostscript is not installed. Install it to enable PDF conversion.",
        500
      );
    }

    throw new AppError(ErrorCode.processingFailed, `PDF to image failed: ${message}`, 422);
  } finally {
    await rm(tempDir, {recursive: true, force: true});
  }
}
