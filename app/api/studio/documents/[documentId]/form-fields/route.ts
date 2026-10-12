import {NextResponse} from "next/server";
import {PDFCheckBox, PDFDocument, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField} from "pdf-lib";
import {getCurrentUser} from "@/lib/auth/server";
import {canAccessGuestJob, getJob} from "@/lib/jobs";
import {guestSessionId} from "@/lib/studio/guest-session";
import {readResultFile, readTemporaryFile} from "@/lib/storage/local";
import {readWorkspaceDocumentFile} from "@/lib/workspace/documents";
import {normalizeFormRoots} from "@/processors/pdf/form-structure";

type Props = {params: Promise<{documentId: string}>};

function fieldData(field: PDFTextField | PDFCheckBox | PDFDropdown | PDFOptionList | PDFRadioGroup) {
  const base = {name: field.getName()};
  if (field instanceof PDFTextField) return {...base, maxLength: field.getMaxLength() ?? undefined, type: "text" as const, value: field.getText() ?? ""};
  if (field instanceof PDFCheckBox) return {...base, type: "checkbox" as const, value: field.isChecked()};
  if (field instanceof PDFDropdown) return {...base, type: "select" as const, options: field.getOptions(), value: field.getSelected()[0] ?? ""};
  if (field instanceof PDFOptionList) return {...base, type: "select" as const, options: field.getOptions(), value: field.getSelected()[0] ?? ""};
  return {...base, type: "radio" as const, options: field.getOptions(), value: field.getSelected() ?? ""};
}

async function fieldsFromPdf(bytes: Buffer) {
  const pdf = await PDFDocument.load(bytes, {ignoreEncryption: false});
  normalizeFormRoots(pdf);
  const fields = pdf.getForm().getFields()
    .filter((field): field is PDFTextField | PDFCheckBox | PDFDropdown | PDFOptionList | PDFRadioGroup => (
      field instanceof PDFTextField || field instanceof PDFCheckBox || field instanceof PDFDropdown || field instanceof PDFOptionList || field instanceof PDFRadioGroup
    ))
    .map(fieldData);

  // A form can expose the same logical field through several widgets. Show it once.
  return [...new Map(fields.map((field) => [field.name, field])).values()];
}

export async function GET(request: Request, {params}: Props) {
  const {documentId} = await params;
  const user = await getCurrentUser(request);
  const job = getJob(documentId);
  const candidates: Array<{bytes: Buffer; source: "input" | "result"}> = [];

  if (job && canAccessGuestJob(job, guestSessionId(request))) {
    const result = await readResultFile(documentId);
    const source = job.fileIds[0] ? await readTemporaryFile(job.fileIds[0]) : null;
    if (result?.result.mimeType === "application/pdf") candidates.push({bytes: result.bytes, source: "result"});
    if (source?.file.mimeType === "application/pdf") candidates.push({bytes: source.bytes, source: "input"});
  } else {
    const workspace = await readWorkspaceDocumentFile(documentId, user?.id);
    if (workspace?.document.resultMimeType === "application/pdf") candidates.push({bytes: workspace.bytes, source: "result"});
  }

  if (candidates.length === 0) return NextResponse.json({error: "PDF form not found"}, {status: 404});

  let emptyCandidate: "input" | "result" | null = null;
  for (const candidate of candidates) {
    try {
      const fields = await fieldsFromPdf(candidate.bytes);
      if (fields.length > 0) {
        return NextResponse.json({fields, source: candidate.source}, {headers: {"Cache-Control": "private, max-age=0, no-store"}});
      }
      emptyCandidate ??= candidate.source;
    } catch {
      // A later candidate can still be the original PDF with usable form fields.
    }
  }

  if (emptyCandidate) return NextResponse.json({fields: [], source: emptyCandidate}, {headers: {"Cache-Control": "private, max-age=0, no-store"}});
  return NextResponse.json({error: "Unable to read PDF form"}, {status: 422});
}
