import {studioToolItems} from "@/content/studio-tools";

// Approval rules apply to saved PDFs, not image/Office exports or unfinished AI tools.
export const workflowToolChoices = studioToolItems.filter((item, index, all) =>
  item.mode !== "comingSoon" && item.mode !== "premium" &&
  (item.group === "toPdf" || item.input === "multiplePdf" ||
    (item.input === "pdf" && item.group !== "fromPdf" && item.tool !== "split_pdf")) &&
  all.findIndex(other => other.tool === item.tool) === index
);
