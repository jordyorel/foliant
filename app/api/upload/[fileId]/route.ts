import {NextResponse} from "next/server";
import {getTemporaryFile, saveTemporaryFile} from "@/lib/storage/local";
import {guestSessionId} from "@/lib/studio/guest-session";
import {ErrorCode, isAppError} from "@/lib/validation/errors";
import {limitRequest} from "@/lib/validation/rate-limit";
import {readLimitedBody} from "@/lib/validation/body";
import {logOperationalEvent} from "@/lib/operations/log";

export const runtime = "nodejs";

type Props = {
  params: Promise<{fileId: string}>;
};

export async function PUT(request: Request, {params}: Props) {
  const limited = limitRequest(request, "upload");
  if (limited) return limited;
  const {fileId} = await params;
  const stored = /^[a-zA-Z0-9_-]+$/.test(fileId) ? getTemporaryFile(fileId) : null;
  const sessionId = guestSessionId(request);
  if (!sessionId || !stored || stored.guestSessionId !== sessionId || Date.parse(stored.expiresAt) <= Date.now()) {
    return NextResponse.json({error: "Upload not found", code: ErrorCode.uploadNotFound}, {status: 404});
  }
  try {
    const bytes = await readLimitedBody(request, stored.maxSize);
    const file = await saveTemporaryFile(fileId, bytes);

    if (!file) {
      return NextResponse.json(
        {error: "Upload not found", code: ErrorCode.uploadNotFound},
        {status: 404}
      );
    }

    return NextResponse.json({
      ok: true,
      fileId: file.id
    });
  } catch (error) {
    logOperationalEvent("upload_failed", {code: isAppError(error) ? error.code : ErrorCode.processingFailed});
    if (isAppError(error)) {
      return NextResponse.json(
        {error: error.message, code: error.code},
        {status: error.status}
      );
    }

    return NextResponse.json(
      {error: "Upload failed", code: ErrorCode.processingFailed},
      {status: 500}
    );
  }
}
