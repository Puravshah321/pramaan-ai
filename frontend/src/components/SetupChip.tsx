import React from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { fetchSetup } from "../api/client";
import { Cpu } from "lucide-react";

export const SetupChip: React.FC = () => {
  const { data: setup } = useQuery({
    queryKey: ["setup"],
    queryFn: fetchSetup,
  });

  const isConfigured = Boolean(setup?.language_model && setup?.embedding_model);
  const embShort = setup?.embedding_model?.split("/").pop() || "No embedding";
  const lmShort = setup?.language_model?.split("/").pop();

  if (!isConfigured) {
    return (
      <Link
        to="/models"
        title="Setup required: Click to choose an active model"
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-ochre bg-paper-raised text-xs font-mono text-ink hover:border-accent transition-colors focus-visible:outline-2 focus-visible:outline-accent"
      >
        <span className="w-2 h-2 rounded-full bg-ochre animate-pulse" />
        <span className="font-sans font-medium text-ink">Setup required</span>
      </Link>
    );
  }

  return (
    <Link
      to="/models"
      title="Click to view or change active model setup"
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-line bg-paper-raised text-xs font-mono text-ink hover:border-accent transition-colors focus-visible:outline-2 focus-visible:outline-accent"
    >
      <Cpu className="w-3.5 h-3.5 text-accent shrink-0" />
      <span className="truncate max-w-[120px] md:max-w-[150px] font-medium" title={setup?.embedding_model || ""}>
        {embShort}
      </span>
      <span className="text-ink-soft">/</span>
      <span className="truncate max-w-[120px] md:max-w-[150px] font-medium text-accent" title={setup?.language_model || ""}>
        {lmShort}
      </span>
    </Link>
  );
};
