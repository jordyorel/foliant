type JobStatus = {id: string; status: "queued" | "processing" | "completed" | "failed"};

function pause(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new DOMException("Aborted", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, milliseconds);
    signal?.addEventListener("abort", abort, {once: true});
    if (signal?.aborted) abort();
  });
}

export async function pollJobUntilSettled<T extends JobStatus>(jobId: string, errorMessage: string, signal?: AbortSignal, onUpdate?: (job: T) => void) {
  for (let attempt = 0; attempt < 180; attempt++) {
    signal?.throwIfAborted();
    const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {cache: "no-store", signal});
    if (!response.ok) throw new Error(errorMessage);
    const job = await response.json() as T;
    signal?.throwIfAborted();
    onUpdate?.(job);
    if (job.status === "completed" || job.status === "failed") return job;
    await pause(700, signal);
  }
  throw new Error(errorMessage);
}
