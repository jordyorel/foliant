import type {ToolAction} from "./actions";

export function maxUploadBytes(tool: ToolAction) {
  const megabytes = tool === "merge_pdf" ? 50 : tool === "compress_image" || tool === "image_to_pdf" ? 15 : tool === "markdown_to_pdf" ? 2 : 25;
  return megabytes * 1024 * 1024;
}
