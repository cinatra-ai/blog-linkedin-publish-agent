import { defineConfig } from "vitest/config";

// The suites are plain Node assertions over this package's own two declaration
// files — no DOM, no aliases, nothing to resolve. What this config is FOR is
// the `include`: without a config of its own a package inherits the host tree's
// config, whose include is written for that tree and collects nothing here, and
// a suite that collects nothing is a suite that gates nothing.
//
// The shared readers live under `test/__tests__/` and are deliberately outside
// this include: they export helpers and declare no test of their own.
export default defineConfig({
  test: {
    include: ["test/**/*.test.mjs"],
  },
});
