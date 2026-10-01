import { useState } from "react";
import { Outlet } from "react-router-dom";
import { PageContext } from "../navigation/PageContext";
import { PageContainer } from "../ui/PageContainer";
import { Header } from "./Header";
import { MobileNav } from "./MobileNav";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900 lg:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to main content
      </a>
      <Sidebar />
      <MobileNav open={menuOpen} onClose={() => setMenuOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((open) => !open)} />
        <main id="main-content" tabIndex={-1} className="flex-1 px-4 py-6 focus:outline-none lg:px-8">
          <PageContainer>
            <PageContext />
            <Outlet />
          </PageContainer>
        </main>
      </div>
    </div>
  );
}