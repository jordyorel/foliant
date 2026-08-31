import {NextResponse} from "next/server";
import {getJob} from "@/lib/jobs";

type Props = {
  params: Promise<{jobId: string}>;
};

export async function GET(_request: Request, {params}: Props) {
  const {jobId} = await params;
  const job = getJob(jobId);

  if (!job) {
    return NextResponse.json({error: "Job not found"}, {status: 404});
  }

  return NextResponse.json(job);
}
