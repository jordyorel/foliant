import {PDFArray, PDFDict, PDFDocument, PDFName, PDFRef} from "pdf-lib";

// Some producers list widgets as form roots instead of their named parent field.
export function normalizeFormRoots(pdf: PDFDocument) {
  const form = pdf.catalog.lookupMaybe(PDFName.of("AcroForm"), PDFDict);
  const fields = form?.lookupMaybe(PDFName.of("Fields"), PDFArray);
  if (!form || !fields) return;

  const roots = [];
  const seen = new Set<string>();
  let changed = false;
  for (const entry of fields.asArray()) {
    let root = entry;
    const ancestors = new Set<string>();
    for (let depth = 0; depth < 64 && root instanceof PDFRef; depth++) {
      const key = root.toString();
      if (ancestors.has(key)) break;
      ancestors.add(key);
      const dict = pdf.context.lookup(root);
      if (!(dict instanceof PDFDict)) break;
      const parent = dict.get(PDFName.of("Parent"));
      if (!(parent instanceof PDFRef) || ancestors.has(parent.toString())) break;
      const parentDict = pdf.context.lookup(parent);
      if (!(parentDict instanceof PDFDict)) break;
      const kids = parentDict.lookupMaybe(PDFName.of("Kids"), PDFArray);
      if (!kids?.asArray().some((kid) => kid instanceof PDFRef && kid.toString() === key)) break;
      root = parent;
    }
    changed ||= root !== entry;
    const key = root instanceof PDFRef ? root.toString() : null;
    if (key && seen.has(key)) {
      changed = true;
      continue;
    }
    if (key) seen.add(key);
    roots.push(root);
  }
  if (changed) form.set(PDFName.of("Fields"), pdf.context.obj(roots));
}
