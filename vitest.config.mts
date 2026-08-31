import {defineConfig} from "vitest/config";
import path from "node:path";
import {fileURLToPath} from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Run test files serially: jobs/storage share in-memory module state.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000
  }
});
