import "@testing-library/jest-dom/vitest";
import { configure } from "@testing-library/react";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { clearSessionToken } from "../utils/session";

// Async UI assertions wait for user-event interaction and fetch mocks to settle.
// The default 1s budget is too tight when many jsdom files run in parallel,
// which produced intermittent failures unrelated to the assertions themselves.
configure({ asyncUtilTimeout: 5000 });

afterEach(() => {
  cleanup();
  clearSessionToken();
});