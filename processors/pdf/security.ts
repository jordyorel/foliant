import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {AppError, ErrorCode} from "@/lib/validation/errors";

const execFileAsync = promisify(execFile);

export type PdfPasswordOptions = {
  password?: string;
};

function requirePassword(password: string | undefined, action: "protect" | "unlock") {
  if (typeof password !== "string" || password.trim().length === 0) {
    throw new AppError(
      ErrorCode.invalidRequest,
      action === "protect" ? "Password is required to protect this PDF." : "Password is required to unlock this PDF.",
      400
    );
  }

  return password;
}

function normalizeQpdfError(error: unknown, action: "protect" | "unlock") {
  const message = error instanceof Error ? error.message : "Unknown qpdf error";
  const lowerMessage = message.toLowerCase();

  if (lowerMessage.includes("enoent")) {
    throw new AppError(
      ErrorCode.qpdfMissing,
      "qpdf is not installed. Install it to enable PDF protection.",
      500
    );
  }

  if (
    action === "unlock" &&
    (lowerMessage.includes("invalid password") || lowerMessage.includes("password is incorrect"))
  ) {
    throw new AppError(ErrorCode.invalidRequest, "The PDF password is incorrect.", 400);
  }

  throw new AppError(
    ErrorCode.processingFailed,
    action === "protect" ? `PDF protection failed: ${message}` : `PDF unlock failed: ${message}`,
    422
  );
}

export async function protectPdf(
  inputPath: string,
  outputPath: string,
  options: PdfPasswordOptions = {}
) {
  const password = requirePassword(options.password, "protect");

  try {
    await execFileAsync("qpdf", [
      "--encrypt",
      password,
      password,
      "256",
      "--",
      inputPath,
      outputPath
    ]);
  } catch (error) {
    normalizeQpdfError(error, "protect");
  }

  return outputPath;
}

export async function unlockPdf(
  inputPath: string,
  outputPath: string,
  options: PdfPasswordOptions = {}
) {
  const password = requirePassword(options.password, "unlock");

  try {
    await execFileAsync("qpdf", [
      `--password=${password}`,
      "--decrypt",
      inputPath,
      outputPath
    ]);
  } catch (error) {
    normalizeQpdfError(error, "unlock");
  }

  return outputPath;
}
