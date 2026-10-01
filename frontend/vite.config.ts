/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/tests/setup.ts",
    // Rendering assertions resolve through async user-event and fetch mocks.
    // Under parallel jsdom execution those can outrun the 5s default and fail
    // intermittently, so the budget is raised rather than any assertion
    // being weakened.
    testTimeout: 20000,
    hookTimeout: 20000,
  },
});
