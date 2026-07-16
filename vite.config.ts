/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";

const STUDIO_API = process.env.FOUNDRY_STUDIO_API ?? "http://127.0.0.1:4400";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    proxy: {
      "/api": {
        target: STUDIO_API,
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: "jsdom",
    // jsdom needs a real (non-opaque) origin or it exposes no localStorage,
    // which the theme persistence code and tests/setup.ts both rely on.
    environmentOptions: {
      jsdom: { url: "http://localhost:3000/" },
    },
    globals: false,
    setupFiles: ["tests/setup.ts"],
    include: ["tests/**/*.test.{ts,tsx}"],
    css: false,
  },
});
