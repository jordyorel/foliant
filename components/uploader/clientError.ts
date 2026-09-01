export type ErrorLabels = {
  error: string;
  errorTooLarge: string;
  errorUnsupportedType: string;
  errorInvalidFile: string;
  errorQpdfMissing?: string;
};

export function messageFromCode(code: string | undefined | null, labels: ErrorLabels): string | null {
  switch (code) {
    case "file_too_large":
      return labels.errorTooLarge;
    case "unsupported_type":
      return labels.errorUnsupportedType;
    case "invalid_file":
      return labels.errorInvalidFile;
    case "qpdf_missing":
      return labels.errorQpdfMissing ?? null;
    default:
      return null;
  }
}

export async function messageFromResponse(response: Response, labels: ErrorLabels): Promise<string> {
  let serverMessage = "";
  let code = "";

  try {
    const body = await response.json();
    if (body && typeof body === "object") {
      serverMessage = typeof body.error === "string" ? body.error : "";
      code = typeof body.code === "string" ? body.code : "";
    }
  } catch {
    // Non-JSON error body; fall back to the generic label.
  }

  return (messageFromCode(code, labels) ?? serverMessage) || labels.error;
}
