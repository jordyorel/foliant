import {compressPdf} from "./compression/pdf";
import {compressImage} from "./compression/image";
import {heicToJpg, heicToPng} from "./image/heic";
import {imageToPdf} from "./image/to-pdf";
import {markdownToPdf} from "./markdown/to-pdf";
import {excelToPdf, powerpointToPdf, wordToPdf} from "./office/to-pdf";
import {deletePdfPages} from "./pdf/delete";
import {extractPdfPages} from "./pdf/extract";
import {fillPdf} from "./pdf/fill";
import {insertPdfPages} from "./pdf/insert";
import {mergePdfs} from "./pdf/merge";
import {numberPdfPages} from "./pdf/number";
import {reorderPdf} from "./pdf/reorder";
import {splitPdf} from "./pdf/split";
import {pdfToExcel} from "./pdf/to-excel";
import {pdfToImage} from "./pdf/to-image";
import {pdfToPowerpoint} from "./pdf/to-powerpoint";
import {pdfToWord} from "./pdf/to-word";
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
  markdown_to_pdf: async (inputPaths, outputPath) => ({
    path: await markdownToPdf(inputPaths[0], outputPath),
    extension: ".pdf",
    mimeType: "application/pdf"
  }),
  word_to_pdf: async (inputPaths, outputPath) => ({
    path: await wordToPdf(inputPaths[0], outputPath),
    extension: ".pdf",
    mimeType: "application/pdf"
  }),
  excel_to_pdf: async (inputPaths, outputPath) => ({
    path: await excelToPdf(inputPaths[0], outputPath),
    extension: ".pdf",
    mimeType: "application/pdf"
  }),
  powerpoint_to_pdf: async (inputPaths, outputPath) => ({
    path: await powerpointToPdf(inputPaths[0], outputPath),
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
  pdf_to_word: async (inputPaths, outputPath) => ({
    path: await pdfToWord(inputPaths[0], outputPath),
    extension: ".docx",
    mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  }),
  pdf_to_excel: async (inputPaths, outputPath) => ({
    path: await pdfToExcel(inputPaths[0], outputPath),
    extension: ".xlsx",
    mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  }),
  pdf_to_powerpoint: async (inputPaths, outputPath) => ({
    path: await pdfToPowerpoint(inputPaths[0], outputPath),
    extension: ".pptx",
    mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  }),
  rotate_pdf: async (inputPaths, outputPath, context) => ({
    path: await rotatePdf(inputPaths[0], outputPath, context.options.rotateDegrees, context.options.pageRange),
    extension: ".pdf",
    mimeType: "application/pdf"
  }),
  extract_pdf_pages: async (inputPaths, outputPath, context) => ({
    path: await extractPdfPages(inputPaths[0], outputPath, context.options.pageRange ?? ""),
    extension: ".pdf",
    mimeType: "application/pdf"
  }),
  fill_pdf: async (inputPaths, outputPath, context) => ({
    path: await fillPdf(inputPaths[0], outputPath, context.options.formValues ?? {}),
    extension: ".pdf",
    mimeType: "application/pdf"
  }),
  delete_pdf_pages: async (inputPaths, outputPath, context) => ({
    path: await deletePdfPages(inputPaths[0], outputPath, context.options.pageRange ?? ""),
    extension: ".pdf",
    mimeType: "application/pdf"
  }),
  insert_pdf_pages: async (inputPaths, outputPath, context) => ({
    path: await insertPdfPages(inputPaths, outputPath, {
      insertAfterPage: context.options.insertAfterPage,
      pageAnnotations: context.options.pageAnnotations,
      pageOrder: context.options.pageOrder,
      pageRotations: context.options.pageRotations
    }),
    extension: ".pdf",
    mimeType: "application/pdf"
  }),
  reorder_pdf: async (inputPaths, outputPath, context) => ({
    path: await reorderPdf(
      inputPaths[0],
      outputPath,
      context.options.pageOrder,
      context.options.pageRotations,
      context.options.pageAnnotations
    ),
    extension: ".pdf",
    mimeType: "application/pdf"
  }),
  sign_pdf: async (inputPaths, outputPath, context) => ({
    path: await reorderPdf(
      inputPaths[0],
      outputPath,
      context.options.pageOrder,
      context.options.pageRotations,
      context.options.pageAnnotations
    ),
    extension: ".pdf",
    mimeType: "application/pdf"
  }),
  number_pdf_pages: async (inputPaths, outputPath, context) => ({
    path: await numberPdfPages(inputPaths[0], outputPath, {
      position: context.options.pageNumberPosition,
      startPage: context.options.pageNumberStartPage,
      startNumber: context.options.pageNumberStartNumber,
      format: context.options.pageNumberFormat,
      color: context.options.pageNumberColor,
      fontSize: context.options.pageNumberFontSize,
      margin: context.options.pageNumberMargin
    }),
    extension: ".pdf",
    mimeType: "application/pdf"
  }),
  watermark_pdf: async (inputPaths, outputPath, context) => ({
    path: await watermarkPdf(inputPaths[0], outputPath, {
      color: context.options.watermarkColor,
      fontSize: context.options.watermarkFontSize,
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
  }),
  heic_to_jpg: async (inputPaths, outputPath) => ({
    path: await heicToJpg(inputPaths[0], outputPath),
    extension: ".jpg",
    mimeType: "image/jpeg"
  }),
  heic_to_png: async (inputPaths, outputPath) => ({
    path: await heicToPng(inputPaths[0], outputPath),
    extension: ".png",
    mimeType: "image/png"
  })
};

export type ProcessorId = keyof typeof processors;

export function getProcessor(processorId: string) {
  return processors[processorId as ProcessorId] ?? null;
}
