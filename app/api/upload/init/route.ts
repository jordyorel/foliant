import {NextResponse} from "next/server";
import {createTemporaryFile} from "@/lib/storage/local";
import {validateUploadInit} from "@/lib/validation/uploads";
import {guestSessionId, withGuestSession} from "@/lib/studio/guest-session";
import {limitRequest} from "@/lib/validation/rate-limit";
import {readLimitedJson} from "@/lib/validation/body";

export async function POST(request: Request) {
  const limited = limitRequest(request, "upload");
  if (limited) return limited;
  const body = await readLimitedJson(request, 8192).catch(() => null);
  const validation = validateUploadInit(body);

  if (!validation.ok) {
    return NextResponse.json(
      {error: validation.error, code: validation.code, maxSize: validation.maxSize},
      {status: validation.status}
    );
  }

  const sessionId = guestSessionId(request) ?? crypto.randomUUID();
  const file = createTemporaryFile({...validation.value, maxSize: validation.maxSize, guestSessionId: sessionId});

  return withGuestSession(request, sessionId, {
    uploadId: file.uploadId,
    fileId: file.id,
    uploadUrl: `/api/upload/${file.id}`,
    maxSize: validation.maxSize,
    expiresAt: file.expiresAt
  });
}
