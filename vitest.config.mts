import {defineConfig} from "vitest/config";
import path from "node:path";
import {fileURLToPath} from "node:url";
import os from "node:os";

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root
    }
  },
  test: {
    env: {
      FOLIANT_TEST_DATA_ROOT: path.join(os.tmpdir(), `foliant-tests-${process.pid}`),
      WORKSPACE_STORAGE_DRIVER: "local"
    },
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Run test files serially: jobs/storage share in-memory module state.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000
  }
});
