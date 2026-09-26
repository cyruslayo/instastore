import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // Threads avoid fork-worker startup timeouts on slower Windows machines.
  test: { include: ["tests/**/*.test.ts"], environment: "jsdom", pool: "threads" },
});
