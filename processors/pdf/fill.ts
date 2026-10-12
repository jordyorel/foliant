import {readFile, writeFile} from "node:fs/promises";
import {PDFCheckBox, PDFDocument, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField} from "pdf-lib";
import {normalizeFormRoots} from "./form-structure";

export type PdfFormValue = boolean | string;

export async function fillPdf(inputPath: string, outputPath: string, values: Record<string, PdfFormValue>) {
  const pdf = await PDFDocument.load(await readFile(inputPath), {ignoreEncryption: false});
  normalizeFormRoots(pdf);
  const form = pdf.getForm();

  for (const field of form.getFields()) {
    const value = values[field.getName()];
    if (value === undefined) continue;

    if (field instanceof PDFTextField && typeof value === "string") field.setText(value);
    else if (field instanceof PDFCheckBox && typeof value === "boolean") value ? field.check() : field.uncheck();
    else if (field instanceof PDFDropdown && typeof value === "string") field.select(value);
    else if (field instanceof PDFOptionList && typeof value === "string") field.select(value);
    else if (field instanceof PDFRadioGroup && typeof value === "string") field.select(value);
  }

  form.updateFieldAppearances();
  await writeFile(outputPath, await pdf.save());
  return outputPath;
}
