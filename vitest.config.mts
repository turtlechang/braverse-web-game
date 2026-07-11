import { defineConfig, defaultExclude } from "vitest/config"

export default defineConfig({
  test: {
    exclude: [
      ...defaultExclude,
      "scripts/opencode-go-benchmark.test.js",
      "scripts/*.test.mjs",
      "scripts/lib/*.test.mjs",
    ],
  },
})
