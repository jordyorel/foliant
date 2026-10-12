import {execFile} from "node:child_process";
import os from "node:os";
import path from "node:path";
import {promisify} from "node:util";
import {AppError, ErrorCode} from "@/lib/validation/errors";

const execFileAsync = promisify(execFile);
const conversionTimeoutMs = 60_000;

function sofficeCandidates() {
  return [
    process.env.LIBREOFFICE_BIN,
    path.join(os.homedir(), ".cache/codex-runtimes/codex-primary-runtime/dependencies/bin/override/soffice"),
    "soffice",
    "libreoffice",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice"
  ].filter(Boolean) as string[];
}

function isMissingExecutable(error: unknown) {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}

export function libreOfficeMissingError() {
  return new AppError(
    ErrorCode.libreOfficeMissing,
    "LibreOffice is not installed. Install it to enable document conversion.",
    500
  );
}

export async function runLibreOffice(args: string[]) {
  let foundExecutable = false;
  let lastError: unknown = null;

  for (const command of sofficeCandidates()) {
    try {
      foundExecutable = true;
      await execFileAsync(command, args, {
        timeout: conversionTimeoutMs,
        maxBuffer: 1024 * 1024 * 4
      });
      return;
    } catch (error) {
      if (isMissingExecutable(error)) {
        foundExecutable = false;
        continue;
      }

      lastError = error;
      break;
    }
  }

  if (!foundExecutable || !lastError) {
    throw libreOfficeMissingError();
  }

  const message = lastError instanceof Error ? lastError.message : "Unknown LibreOffice error";
  throw new AppError(ErrorCode.processingFailed, `LibreOffice conversion failed: ${message}`, 422);
}
