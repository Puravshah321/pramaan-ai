import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SetupChip } from "./SetupChip";
import { Menu, X, HelpCircle } from "lucide-react";

interface HeaderProps {
  onOpenHelp?: () => void;
}

const NAV_ITEMS = [
  { name: "Home", path: "/" },
  { name: "Guide", path: "/guide" },
  { name: "Models", path: "/models" },
  { name: "Benchmark", path: "/benchmark" },
  { name: "Results", path: "/results" },
  { name: "Recommend", path: "/recommend" },
  { name: "Try It", path: "/try-it" },
];

export const Header: React.FC<HeaderProps> = ({ onOpenHelp }) => {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 w-full h-[72px] border-b border-line bg-paper/95 backdrop-blur-sm">
      <div className="max-w-[1160px] mx-auto px-4 h-[72px] flex items-center justify-between gap-4">
        {/* Left: Logo & Brand */}
        <Link to="/" className="flex items-center gap-2 shrink-0 group">
          <span className="w-5 h-5 bg-accent rounded-sm inline-flex items-center justify-center text-paper-raised text-xs font-bold leading-none select-none">
            ◼
          </span>
          <span className="font-serif font-bold text-xl text-ink tracking-tight">
            Pramaan AI
          </span>
        </Link>

        {/* Centre: Navigation (Desktop, >= 820px) */}
        <nav className="hidden min-[820px]:flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  isActive
                    ? "text-accent bg-paper-raised font-semibold border-b-2 border-accent"
                    : "text-ink hover:text-accent hover:bg-paper-raised/60"
                }`}
              >
                {item.name}
              </Link>
            );
          })}
        </nav>

        {/* Right: Active setup chip & Help button */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="hidden sm:block">
            <SetupChip />
          </div>

          <button
            type="button"
            onClick={onOpenHelp}
            className="p-2 rounded-lg text-ink hover:text-accent hover:bg-paper-raised transition-colors focus-visible:outline-2 focus-visible:outline-accent"
            title="Open page guide and tips"
            aria-label="Open page guide"
          >
            <HelpCircle className="w-5 h-5" />
          </button>

          {/* Mobile hamburger button (< 820px) */}
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="min-[820px]:hidden p-2 rounded-lg text-ink hover:text-accent hover:bg-paper-raised transition-colors"
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile navigation drawer */}
      {mobileMenuOpen && (
        <div className="min-[820px]:hidden border-b border-line bg-paper-raised px-4 pt-2 pb-4 space-y-2">
          <div className="pb-2 border-b border-line sm:hidden">
            <span className="text-xs text-ink-soft block mb-1">Active Setup:</span>
            <SetupChip />
          </div>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`px-3 py-2 text-base font-medium rounded-md transition-colors ${
                    isActive
                      ? "text-accent bg-paper font-semibold border-l-4 border-accent"
                      : "text-ink hover:text-accent hover:bg-paper"
                  }`}
                >
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </header>
  );
};
