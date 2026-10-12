import {describe, expect, it} from "vitest";
import {PDFArray, PDFDict, PDFDocument, PDFName} from "pdf-lib";
import {normalizeFormRoots} from "@/processors/pdf/form-structure";

describe("form root normalization", () => {
  it("restores one named field shared by two incorrectly listed widgets", async () => {
    const pdf = await PDFDocument.create();
    const page = pdf.addPage();
    const form = pdf.getForm();
    const name = form.createTextField("partner_name");
    name.addToPage(page, {x: 10, y: 10, width: 150, height: 20});
    name.addToPage(page, {x: 10, y: 50, width: 150, height: 20});
    const acroForm = pdf.catalog.lookup(PDFName.of("AcroForm"), PDFDict);
    const kids = name.acroField.dict.lookup(PDFName.of("Kids"), PDFArray);
    acroForm.set(PDFName.of("Fields"), pdf.context.obj(kids.asArray()));

    const loaded = await PDFDocument.load(await pdf.save());
    normalizeFormRoots(loaded);
    expect(loaded.getForm().getFields().map((field) => field.getName())).toEqual(["partner_name"]);
    loaded.getForm().getTextField("partner_name").setText("QA Foliant");
    const result = await PDFDocument.load(await loaded.save());
    expect(result.getForm().getTextField("partner_name").getText()).toBe("QA Foliant");
    expect(result.getForm().getTextField("partner_name").acroField.getWidgets()).toHaveLength(2);
  });

  it("leaves valid hierarchical fields unchanged", async () => {
    const pdf = await PDFDocument.create();
    pdf.getForm().createTextField("applicant.name").addToPage(pdf.addPage());
    const form = pdf.catalog.lookup(PDFName.of("AcroForm"), PDFDict);
    const roots = form.get(PDFName.of("Fields"));
    normalizeFormRoots(pdf);
    expect(form.get(PDFName.of("Fields"))).toBe(roots);
    expect(pdf.getForm().getFields()[0].getName()).toBe("applicant.name");
  });
});
