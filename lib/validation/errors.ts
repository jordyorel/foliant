export const ErrorCode = {
  invalidRequest: "invalid_request",
  unsupportedTool: "unsupported_tool",
  fileTooLarge: "file_too_large",
  unsupportedType: "unsupported_type",
  invalidFile: "invalid_file",
  uploadNotFound: "upload_not_found",
  jobNotFound: "job_not_found",
  jobNotComplete: "job_not_complete",
  resultNotFound: "result_not_found",
  processorMissing: "processor_missing",
  ghostscriptMissing: "ghostscript_missing",
  processingFailed: "processing_failed"
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

export class AppError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.status = status;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
