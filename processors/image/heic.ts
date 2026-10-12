import {execFile} from "node:child_process";
import {promisify} from "node:util";
import {mkdtemp, rm} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
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
    if (format === "png") attempts.push(async () => {
      const directory = await mkdtemp(path.join(os.tmpdir(), "foliant-heic-"));
      try {
        const intermediate = path.join(directory, "decoded.tiff");
        await execFileAsync("sips", ["-s", "format", "tiff", inputPath, "--out", intermediate]);
        await sharp(intermediate).png().toFile(outputPath);
      } finally {await rm(directory, {recursive: true, force: true});}
    });
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
