import {AppError, ErrorCode} from "./errors";

export async function readLimitedJson(request: Request, maximum = 256 * 1024) {
  return JSON.parse(new TextDecoder().decode(await readLimitedBody(request, maximum)));
}

export async function readLimitedBody(request: Pick<Request, "headers" | "body">, maximum: number) {
  const length = request.headers.get("content-length");
  if (length && Number(length) > maximum) {
    throw new AppError(ErrorCode.fileTooLarge, "Request body is too large.", 413);
  }
  const reader = request.body?.getReader();
  if (!reader) return new ArrayBuffer(0);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximum) {
        await reader.cancel();
        throw new AppError(ErrorCode.fileTooLarge, "Request body is too large.", 413);
      }
      chunks.push(value);
    }
  } finally {reader.releaseLock();}
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {bytes.set(chunk, offset); offset += chunk.length;}
  return bytes.buffer;
}
