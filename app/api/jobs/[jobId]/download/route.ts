import {NextResponse} from "next/server";
import {canAccessGuestJob, getJob, recordJobDownload} from "@/lib/jobs";
import {guestSessionId} from "@/lib/studio/guest-session";
import {readResultFile} from "@/lib/storage/local";

type Props = {
  params: Promise<{jobId: string}>;
};

export async function GET(request: Request, {params}: Props) {
  const {jobId} = await params;
  const job = getJob(jobId);

  if (!job || !canAccessGuestJob(job, guestSessionId(request))) {
    return NextResponse.json({error: "Job not found"}, {status: 404});
  }

  if (job.status !== "completed") {
    return NextResponse.json({error: "Job is not completed"}, {status: 409});
  }

  const file = await readResultFile(jobId);

  if (!file) {
    return NextResponse.json({error: "Result not found"}, {status: 404});
  }

  recordJobDownload(jobId);
  return new Response(file.bytes, {
    headers: {
      "Content-Type": file.result.mimeType,
      "Content-Disposition": `attachment; filename="${file.result.fileName}"`,
      "Cache-Control": "private, max-age=0, no-store"
    }
  });
}
