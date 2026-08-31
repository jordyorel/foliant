import {NextResponse} from "next/server";
import {saveTemporaryFile} from "@/lib/storage/local";
import {ErrorCode, isAppError} from "@/lib/validation/errors";

export const runtime = "nodejs";

type Props = {
  params: Promise<{fileId: string}>;
};

export async function PUT(request: Request, {params}: Props) {
  const {fileId} = await params;
  const bytes = await request.arrayBuffer();

  try {
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
