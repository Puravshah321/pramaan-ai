import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { searchModels, fetchModelDetails, type ModelSearchResult } from "../api/client";
import { Search, CheckCircle, Lock, Download, AlertCircle, Loader2 } from "lucide-react";

interface ModelPickerProps {
  label: string;
  task: "embedding" | "generation";
  value: string;
  onChange: (modelId: string) => void;
}

export const ModelPicker: React.FC<ModelPickerProps> = ({
  label,
  task,
  value,
  onChange,
}) => {
  const [searchTerm, setSearchTerm] = useState(value);
  const [debouncedQuery, setDebouncedQuery] = useState(value);
  const [isOpen, setIsOpen] = useState(false);

  // 300ms debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchTerm);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchTerm]);

  // Live search query
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ["modelSearch", debouncedQuery, task],
    queryFn: () => searchModels(debouncedQuery, task),
    enabled: isOpen && debouncedQuery.length > 1,
  });

  // Fetch metadata check for currently selected value
  const { data: selectedDetails, isLoading: isChecking } = useQuery({
    queryKey: ["modelDetails", value],
    queryFn: () => fetchModelDetails(value),
    enabled: !!value,
  });

  const formatParams = (num?: number | null) => {
    if (!num) return null;
    if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(0)}M`;
    return `${num}`;
  };

  return (
    <div className="flex flex-col gap-1.5 w-full">
      <label className="text-xs font-semibold font-mono text-ink-soft uppercase tracking-wider">
        {label}
      </label>

      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2 bg-paper rounded-lg border border-line focus-within:border-accent">
          <Search className="w-4 h-4 text-ink-soft shrink-0" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setIsOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && searchTerm.trim()) {
                e.preventDefault();
                onChange(searchTerm.trim());
                setIsOpen(false);
              }
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => {
              if (searchTerm.includes("/") && searchTerm.trim() !== value) {
                onChange(searchTerm.trim());
              }
              setTimeout(() => setIsOpen(false), 250);
            }}
            placeholder="Search Hugging Face or paste owner/model..."
            className="w-full bg-transparent font-mono text-sm text-ink placeholder:text-ink-soft/60 focus:outline-none"
          />
          {isSearching && <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />}
        </div>

        {/* Dropdown list */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 mt-1 max-h-64 overflow-y-auto bg-paper-raised border border-line rounded-lg shadow-lg z-50">
            {debouncedQuery.includes("/") && (
              <div
                onClick={() => {
                  onChange(debouncedQuery.trim());
                  setSearchTerm(debouncedQuery.trim());
                  setIsOpen(false);
                }}
                className="p-2.5 bg-paper border-b border-line hover:bg-paper-raised cursor-pointer font-mono text-xs text-accent font-bold flex items-center justify-between"
              >
                <span>Check custom ID: "{debouncedQuery}"</span>
                <span className="text-[10px] text-ink-soft">Click or press Enter</span>
              </div>
            )}
            {searchResults && searchResults.map((m: ModelSearchResult) => {
              const paramStr = formatParams(m.parameters);
              return (
                <div
                  key={m.id}
                  onClick={() => {
                    onChange(m.id);
                    setSearchTerm(m.id);
                    setIsOpen(false);
                  }}
                  className="p-2.5 border-b border-line/60 hover:bg-paper cursor-pointer flex flex-col gap-1 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm font-semibold text-ink truncate" title={m.id}>
                      {m.id}
                    </span>
                    {m.gated ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-mono text-ochre bg-ochre/15 px-1.5 py-0.5 rounded">
                        <Lock className="w-3 h-3" /> needs access
                      </span>
                    ) : m.inference_available ? (
                      <span className="text-[11px] font-mono text-sage-deep bg-sage/20 px-1.5 py-0.5 rounded">
                        API route
                      </span>
                    ) : (
                      <span className="text-[11px] font-mono text-ink-soft bg-paper px-1.5 py-0.5 rounded">
                        Local only
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-ink-soft font-mono">
                    <span className="flex items-center gap-1">
                      <Download className="w-3 h-3" /> {m.downloads.toLocaleString()}
                    </span>
                    {paramStr && <span>{paramStr} params</span>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Model check status message */}
      <div className="mt-1">
        {isChecking ? (
          <span className="text-xs text-ink-soft font-mono flex items-center gap-1">
            <Loader2 className="w-3 h-3 animate-spin text-accent" /> Checking model on Hub...
          </span>
        ) : selectedDetails ? (
          selectedDetails.available ? (
            <div className="text-xs font-mono text-ink-soft flex items-center gap-2 flex-wrap">
              <span className="text-sage-deep font-semibold flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                {selectedDetails.inference_route === "api" ? "available via API" : "local runner only"}
              </span>
              {selectedDetails.parameters && (
                <>
                  <span>•</span>
                  <span>{formatParams(selectedDetails.parameters)} params</span>
                </>
              )}
              {selectedDetails.estimated_memory_gb && (
                <>
                  <span>•</span>
                  <span>~{selectedDetails.estimated_memory_gb} GB (Estimated)</span>
                </>
              )}
              {selectedDetails.license && selectedDetails.license !== "unknown" && (
                <>
                  <span>•</span>
                  <span>{selectedDetails.license}</span>
                </>
              )}
            </div>
          ) : (
            <div className="text-xs font-mono text-accent flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>{selectedDetails.error || "Model unavailable"}</span>
              {selectedDetails.access_url && (
                <a
                  href={selectedDetails.access_url}
                  target="_blank"
                  rel="noreferrer"
                  className="underline ml-1 text-ink hover:text-accent"
                >
                  Request access on Hugging Face
                </a>
              )}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
};
