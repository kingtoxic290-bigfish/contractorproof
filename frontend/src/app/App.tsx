import { BrowserRouter } from "react-router-dom";
import { AppProviders } from "./providers/AppProviders";
import { AppRouter } from "./router";

export default function App() {
  return (
    <BrowserRouter>
      <AppProviders>
        <AppRouter />
      </AppProviders>
    </BrowserRouter>
  );
}
