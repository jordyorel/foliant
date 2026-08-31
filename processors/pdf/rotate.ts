import {readFile, writeFile} from "node:fs/promises";
import {degrees, PDFDocument} from "pdf-lib";
import {AppError, ErrorCode} from "@/lib/validation/errors";

export type RotateDegrees = 90 | 180 | 270;

function resolveRotation(rotation?: number): RotateDegrees {
  if (rotation === 180 || rotation === 270) return rotation;
  return 90;
}

export async function rotatePdf(inputPath: string, outputPath: string, rotation?: number) {
  const bytes = await readFile(inputPath);
  const pdf = await PDFDocument.load(bytes, {ignoreEncryption: false}).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Unknown PDF rotation error";
    throw new AppError(ErrorCode.processingFailed, `PDF rotation failed: ${message}`, 422);
  });
  const rotationDegrees = resolveRotation(rotation);

  for (const page of pdf.getPages()) {
    const currentRotation = page.getRotation().angle;
    page.setRotation(degrees((currentRotation + rotationDegrees) % 360));
  }

  await writeFile(outputPath, await pdf.save());
  return outputPath;
}
