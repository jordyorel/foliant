import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {AppError, ErrorCode} from "@/lib/validation/errors";

const execFileAsync = promisify(execFile);

export type PdfCompressionLevel = "screen" | "ebook" | "printer";

export async function compressPdf(inputPath: string, outputPath: string, level: PdfCompressionLevel = "ebook") {
  try {
    await execFileAsync("gs", [
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      `-dPDFSETTINGS=/${level}`,
      "-dNOPAUSE",
      "-dQUIET",
      "-dBATCH",
      `-sOutputFile=${outputPath}`,
      inputPath
    ]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Ghostscript error";

    if (message.includes("ENOENT")) {
      throw new AppError(
        ErrorCode.ghostscriptMissing,
        "Ghostscript is not installed. Install it to enable PDF compression.",
        500
      );
    }

    throw new AppError(ErrorCode.processingFailed, `PDF compression failed: ${message}`, 422);
  }

  return outputPath;
}
