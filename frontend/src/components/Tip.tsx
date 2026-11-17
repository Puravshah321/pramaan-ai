import React, { useState } from "react";
import { HelpCircle } from "lucide-react";
import { GLOSSARY } from "../lib/glossary";

interface TipProps {
  term: string;
  children?: React.ReactNode;
}

export const Tip: React.FC<TipProps> = ({ term, children }) => {
  const [open, setOpen] = useState(false);
  const definition = GLOSSARY[term.toLowerCase()] || "";

  return (
    <span
      className="relative inline-flex items-center gap-1 cursor-help border-b border-dotted border-ink-soft"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen(!open)}
    >
      <span>{children || term}</span>
      <HelpCircle className="w-3 h-3 text-ink-soft/70 inline" />
      {open && definition && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 p-2.5 bg-paper-raised text-ink text-xs rounded-lg border border-line shadow-sm z-50 pointer-events-none">
          <strong className="block text-ink font-semibold mb-1 capitalize">{term}:</strong>
          {definition}
        </span>
      )}
    </span>
  );
};
