import {compressPdf} from "./compression/pdf";
import {compressImage} from "./compression/image";
import {imageToPdf} from "./image/to-pdf";
import {deletePdfPages} from "./pdf/delete";
import {extractPdfPages} from "./pdf/extract";
import {mergePdfs} from "./pdf/merge";
import {numberPdfPages} from "./pdf/number";
import {splitPdf} from "./pdf/split";
import {pdfToImage} from "./pdf/to-image";
import {rotatePdf} from "./pdf/rotate";
import {protectPdf, unlockPdf} from "./pdf/security";
import {watermarkPdf} from "./pdf/watermark";
import type {JobOptions} from "@/lib/jobs";

export type ProcessorResult = {
  path: string;
  extension: string;
  mimeType: string;
};

export type ProcessorContext = {
  options: JobOptions;
};

export type Processor = (
  inputPaths: string[],
  outputPath: string,
  context: ProcessorContext
) => Promise<ProcessorResult>;

export const processors: Record<string, Processor> = {
  compress_pdf: async (inputPaths, outputPath, context) => ({
    path: await compressPdf(inputPaths[0], outputPath, context.options.pdfCompressionLevel),
    extension: ".pdf",
    mimeType: "application/pdf"
  }),
  compress_image: async (inputPaths, outputPath, context) => compressImage(
    inputPaths[0],
    outputPath,
    context.options.imageCompressionLevel
  ),
  merge_pdf: async (inputPaths, outputPath) => ({
    path: await mergePdfs(inputPaths, outputPath),
    extension: ".pdf",
    mimeType: "application/pdf"
  }),
  split_pdf: async (inputPaths, outputPath, context) => ({
    path: await splitPdf(inputPaths[0], outputPath, {
      mode: context.options.splitMode,
      interval: context.options.splitInterval,
      pageRange: context.options.pageRange
    }),
    extension: ".zip",
    mimeType: "application/zip"
  }),
  image_to_pdf: async (inputPaths, outputPath) => ({
    path: await imageToPdf(inputPaths, outputPath),
    extension: ".pdf",
    mimeType: "application/pdf"
  }),
  pdf_to_image: async (inputPaths, outputPath, context) => ({
    path: await pdfToImage(inputPaths[0], outputPath, {
      format: context.options.pdfToImageFormat,
      dpi: context.options.pdfToImageDpi
    }),
    extension: ".zip",
    mimeType: "application/zip"
  }),
  rotate_pdf: async (inputPaths, outputPath, context) => ({
    path: await rotatePdf(inputPaths[0], outputPath, context.options.rotateDegrees),
    extension: ".pdf",
    mimeType: "application/pdf"
  }),
  extract_pdf_pages: async (inputPaths, outputPath, context) => ({
    path: await extractPdfPages(inputPaths[0], outputPath, context.options.pageRange ?? ""),
    extension: ".pdf",
    mimeType: "application/pdf"
  }),
  delete_pdf_pages: async (inputPaths, outputPath, context) => ({
    path: await deletePdfPages(inputPaths[0], outputPath, context.options.pageRange ?? ""),
    extension: ".pdf",
    mimeType: "application/pdf"
  }),
  number_pdf_pages: async (inputPaths, outputPath, context) => ({
    path: await numberPdfPages(inputPaths[0], outputPath, {
      position: context.options.pageNumberPosition,
      startPage: context.options.pageNumberStartPage,
      startNumber: context.options.pageNumberStartNumber
    }),
    extension: ".pdf",
    mimeType: "application/pdf"
  }),
  watermark_pdf: async (inputPaths, outputPath, context) => ({
    path: await watermarkPdf(inputPaths[0], outputPath, {
      text: context.options.watermarkText,
      position: context.options.watermarkPosition,
      opacity: context.options.watermarkOpacity
    }),
    extension: ".pdf",
    mimeType: "application/pdf"
  }),
  protect_pdf: async (inputPaths, outputPath, context) => ({
    path: await protectPdf(inputPaths[0], outputPath, {
      password: context.options.pdfPassword
    }),
    extension: ".pdf",
    mimeType: "application/pdf"
  }),
  unlock_pdf: async (inputPaths, outputPath, context) => ({
    path: await unlockPdf(inputPaths[0], outputPath, {
      password: context.options.pdfPassword
    }),
    extension: ".pdf",
    mimeType: "application/pdf"
  })
};

export type ProcessorId = keyof typeof processors;

export function getProcessor(processorId: string) {
  return processors[processorId as ProcessorId] ?? null;
}
