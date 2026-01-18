import path from "node:path";
import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

// Cargar variables de entorno desde .env
dotenv.config();

export default defineConfig({
  test: {
    root: ".",
    include: ["tests/**/*.{test,spec}.{ts,tsx}", "tests/**/*.{test,spec}.ts"],
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
  },
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
});
