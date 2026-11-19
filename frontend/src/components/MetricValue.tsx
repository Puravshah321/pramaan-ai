import React from "react";

interface MetricValueProps {
  value: number | string | null | undefined;
  unit?: string;
  source?: "measured" | "local" | "api" | "estimated" | "not available";
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

  let formattedVal: string;
  let displayUnit = unit;

  if (formatter) {
    formattedVal = formatter(value);
  } else if (typeof value === "number") {
    if (unit === "ms" || unit === "s") {
      // Latency formatting: standard is ms storage
      const ms = unit === "s" && value < 100 ? value * 1000 : value;
      if (ms >= 1000) {
        formattedVal = (ms / 1000).toFixed(2);
        displayUnit = "s";
      } else {
        formattedVal = Math.round(ms).toString();
        displayUnit = "ms";
      }
    } else if (Number.isInteger(value)) {
      formattedVal = value.toString();
    } else {
      // Float metrics (F1, EM, Recall) default to 3 decimals
      formattedVal = value.toFixed(3);
    }
  } else {
    formattedVal = String(value);
  }

  const sourceLabels: Record<string, { label: string; class: string }> = {
    measured: { label: "Measured", class: "bg-sage/20 text-sage-deep border-sage" },
    local: { label: "Local latency", class: "bg-paper text-ink-soft border-line" },
    api: { label: "Local latency", class: "bg-paper text-ink-soft border-line" },
    estimated: { label: "Estimated", class: "bg-ochre/15 text-ochre border-ochre/40" },
    "not available": { label: "N/A", class: "bg-paper text-ink-soft border-line" },
  };

  const badge = source ? sourceLabels[source] || { label: source, class: "border-line text-ink-soft" } : null;

  return (
    <div className="inline-flex flex-col items-start gap-0.5">
      <div className="flex items-baseline gap-1 font-mono text-ink">
        <span className="font-semibold">{formattedVal}</span>
        {displayUnit && <span className="text-xs text-ink-soft">{displayUnit}</span>}
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
