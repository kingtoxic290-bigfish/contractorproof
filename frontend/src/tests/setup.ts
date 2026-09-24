import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import { clearSessionToken } from "../utils/session";

afterEach(() => {
  cleanup();
  clearSessionToken();
});
