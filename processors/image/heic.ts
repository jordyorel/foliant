import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {AppError, ErrorCode} from "@/lib/validation/errors";

const execFileAsync = promisify(execFile);

type HeicOutputFormat = "jpeg" | "png";

function decoderMissingError(): AppError {
  return new AppError(
    ErrorCode.heicDecoderMissing,
    "No HEIC decoder is available. Install sips (macOS) or ImageMagick / libheif to enable HEIC conversion.",
    500
  );
}

function isEnoent(error: unknown) {
  return (error as NodeJS.ErrnoException)?.code === "ENOENT";
}

async function convertHeic(inputPath: string, outputPath: string, format: HeicOutputFormat, action: string) {
  const attempts: Array<() => Promise<unknown>> = [];
  let lastError: unknown = null;
  let triedAvailableDecoder = false;

  if (process.platform === "darwin") {
    attempts.push(() => execFileAsync("sips", ["-s", "format", format, inputPath, "--out", outputPath]));
  }
  attempts.push(() => execFileAsync("magick", [inputPath, outputPath]));
  attempts.push(() => execFileAsync("heif-convert", [inputPath, outputPath]));

  for (const run of attempts) {
    try {
      await run();
      return outputPath;
    } catch (error) {
      if (!isEnoent(error)) {
        triedAvailableDecoder = true;
        lastError = error;
      }
    }
  }

  if (triedAvailableDecoder) {
    const message = lastError instanceof Error ? lastError.message : "Unknown HEIC conversion error";
    throw new AppError(ErrorCode.processingFailed, `${action} failed: ${message}`, 422);
  }

  throw decoderMissingError();
}

export async function heicToJpg(inputPath: string, outputPath: string) {
  return convertHeic(inputPath, outputPath, "jpeg", "HEIC to JPG conversion");
}

export async function heicToPng(inputPath: string, outputPath: string) {
  return convertHeic(inputPath, outputPath, "png", "HEIC to PNG conversion");
}
