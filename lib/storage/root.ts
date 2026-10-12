import path from "node:path";

// Test cleanup must never remove files being edited in the running application.
export const storageRoot = process.env.NODE_ENV === "test" && process.env.FOLIANT_TEST_DATA_ROOT
  ? process.env.FOLIANT_TEST_DATA_ROOT
  : process.env.NODE_ENV === "test"
    ? path.join(process.cwd(), ".tmp")
    : path.resolve(/* turbopackIgnore: true */ process.env.FOLIANT_DATA_ROOT || path.join(process.cwd(), ".tmp"));
