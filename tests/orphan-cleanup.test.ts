import {writeFile, utimes, access, unlink} from "node:fs/promises";
import {describe, expect, it} from "vitest";
import {cleanupOrphanResults, createResultPath, retainJobFiles, resultTtlMs,
  createTemporaryFile, saveTemporaryFile, cleanupExpiredFiles} from "@/lib/storage/local";

describe("temporary worker file protection", () => {
  it("removes only old unregistered inactive outputs", async () => {
    const oldId = `job_${crypto.randomUUID()}`;
    const activeId = `job_${crypto.randomUUID()}`;
    const recentId = `job_${crypto.randomUUID()}`;
    const old = await createResultPath(oldId);
    const active = await createResultPath(activeId);
    const recent = await createResultPath(recentId);
    const release = retainJobFiles(activeId, []);
    try {
      for (const file of [old, active, recent]) await writeFile(file, "partial");
      const expired = new Date(Date.now() - resultTtlMs - 1000);
      await utimes(old, expired, expired);
      await utimes(active, expired, expired);
      await cleanupOrphanResults();
      await expect(access(old)).rejects.toMatchObject({code: "ENOENT"});
      await expect(access(active)).resolves.toBeUndefined();
      await expect(access(recent)).resolves.toBeUndefined();
      release();
      await cleanupOrphanResults();
      await expect(access(active)).rejects.toMatchObject({code: "ENOENT"});
    } finally {
      release();
      for (const file of [old, active, recent]) await unlink(file).catch(() => {});
    }
  });

  it("keeps expired input bytes until all referencing jobs release them", async () => {
    const file = createTemporaryFile({fileName: "test.pdf", fileSize: 5,
      mimeType: "application/pdf", tool: "rotate_pdf", maxSize: 100});
    await saveTemporaryFile(file.id, new TextEncoder().encode("%PDF-test").buffer);
    const releaseA = retainJobFiles(`job_${crypto.randomUUID()}`, [file.id]);
    const releaseB = retainJobFiles(`job_${crypto.randomUUID()}`, [file.id]);
    try {
      const afterExpiry = Date.parse(file.expiresAt) + 1;
      await cleanupExpiredFiles(afterExpiry);
      await expect(access(file.path)).resolves.toBeUndefined();
      releaseA();
      await cleanupExpiredFiles(afterExpiry);
      await expect(access(file.path)).resolves.toBeUndefined();
      releaseB();
      await cleanupExpiredFiles(afterExpiry);
      await expect(access(file.path)).rejects.toMatchObject({code: "ENOENT"});
    } finally { releaseA(); releaseB(); }
  });
});
