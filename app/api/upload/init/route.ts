import {NextResponse} from "next/server";
import {createTemporaryFile} from "@/lib/storage/local";
import {validateUploadInit} from "@/lib/validation/uploads";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const validation = validateUploadInit(body);

  if (!validation.ok) {
    return NextResponse.json(
      {error: validation.error, code: validation.code, maxSize: validation.maxSize},
      {status: validation.status}
    );
  }

  const file = createTemporaryFile({...validation.value, maxSize: validation.maxSize});

  return NextResponse.json({
    uploadId: file.uploadId,
    fileId: file.id,
    uploadUrl: `/api/upload/${file.id}`,
    maxSize: validation.maxSize,
    expiresAt: file.expiresAt
  });
}
