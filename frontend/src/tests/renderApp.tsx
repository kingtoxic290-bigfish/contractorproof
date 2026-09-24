import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AppProviders } from "../app/providers/AppProviders";
import { AppRouter } from "../app/router";
import { writeSessionToken } from "../utils/session";

export function renderApp(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </MemoryRouter>,
  );
}

export function seedSession(): void {
  writeSessionToken("test-session");
}
