import {NextResponse} from "next/server";
import {canAccessGuestJob, getJob, publicJob} from "@/lib/jobs";
import {guestSessionId} from "@/lib/studio/guest-session";

type Props = {
  params: Promise<{jobId: string}>;
};

export async function GET(request: Request, {params}: Props) {
  const {jobId} = await params;
  const job = getJob(jobId);

  if (!job || !canAccessGuestJob(job, guestSessionId(request))) {
    return NextResponse.json({error: "Job not found"}, {status: 404});
  }

  return NextResponse.json(publicJob(job), {headers: {"Cache-Control": "private, no-store"}});
}
