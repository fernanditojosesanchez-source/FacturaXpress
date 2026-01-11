import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    root: ".",
    include: ["tests/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.ts"],
    environment: "node",
    globals: true,
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
});
