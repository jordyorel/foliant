import {NextResponse} from "next/server";
import {canAccessGuestJob, getJob} from "@/lib/jobs";
import {guestSessionId} from "@/lib/studio/guest-session";
import {readTemporaryFile} from "@/lib/storage/local";

type Props = {
  params: Promise<{jobId: string}>;
};

export async function GET(request: Request, {params}: Props) {
  const {jobId} = await params;
  const job = getJob(jobId);

  if (!job || !canAccessGuestJob(job, guestSessionId(request))) {
    return NextResponse.json({error: "Job not found"}, {status: 404});
  }

  const sourceFileId = job.fileIds[0];
  if (!sourceFileId) {
    return NextResponse.json({error: "Source not found"}, {status: 404});
  }

  const file = await readTemporaryFile(sourceFileId);

  if (!file) {
    return NextResponse.json({error: "Source not found"}, {status: 404});
  }

  if (file.file.mimeType !== "application/pdf") {
    return NextResponse.json({error: "Preview is only available for PDF sources"}, {status: 415});
  }

  return new Response(file.bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${file.file.fileName}"`,
      "Cache-Control": "private, max-age=0, no-store"
    }
  });
}
