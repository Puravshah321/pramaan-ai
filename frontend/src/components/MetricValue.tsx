import React from "react";

interface MetricValueProps {
  value: number | string | null | undefined;
  unit?: string;
  source?: "measured" | "api" | "estimated" | "not available";
  n?: number;
  ciLower?: number | null;
  ciUpper?: number | null;
  formatter?: (val: any) => string;
}

export const MetricValue: React.FC<MetricValueProps> = ({
  value,
  unit = "",
  source,
  n,
  ciLower,
  ciUpper,
  formatter,
}) => {
  if (value === null || value === undefined) {
    return <span className="text-ink-soft text-sm font-mono">—</span>;
  }

  const formattedVal = formatter ? formatter(value) : value.toString();

  const sourceLabels: Record<string, { label: string; class: string }> = {
    measured: { label: "Measured", class: "bg-sage/20 text-sage-deep border-sage" },
    api: { label: "API latency", class: "bg-paper text-ink-soft border-line" },
    estimated: { label: "Estimated", class: "bg-ochre/15 text-ochre border-ochre/40" },
    "not available": { label: "N/A", class: "bg-paper text-ink-soft border-line" },
  };

  const badge = source ? sourceLabels[source] || { label: source, class: "border-line text-ink-soft" } : null;

  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <div className="flex items-baseline gap-1 font-mono text-ink">
        <span className="font-semibold">{formattedVal}</span>
        {unit && <span className="text-xs text-ink-soft">{unit}</span>}
      </div>

      {ciLower !== null && ciLower !== undefined && ciUpper !== null && ciUpper !== undefined && (
        <span className="text-[11px] font-mono text-ink-soft">
          95% CI [{ciLower.toFixed(3)}, {ciUpper.toFixed(3)}]
        </span>
      )}

      <div className="flex items-center gap-1.5 mt-0.5">
        {badge && (
          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${badge.class}`}>
            {badge.label}
          </span>
        )}
        {n !== undefined && n > 0 && (
          <span className="text-[10px] font-mono text-ink-soft">
            n={n}
          </span>
        )}
      </div>
    </div>
  );
};
