import React from "react";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";

interface ReliabilityBadgeProps {
  status: "Reliable" | "Uncertain" | "Unreliable" | string;
  confidence?: number;
  reasons?: string[];
  showDetails?: boolean;
}

export const ReliabilityBadge: React.FC<ReliabilityBadgeProps> = ({
  status,
  confidence,
  reasons = [],
  showDetails = false,
}) => {
  const config = {
    Reliable: {
      color: "text-sage-deep bg-sage/20 border-sage-deep/30",
      icon: <CheckCircle2 className="w-4 h-4 text-sage-deep shrink-0" />,
    },
    Uncertain: {
      color: "text-ochre bg-ochre/15 border-ochre/40",
      icon: <AlertTriangle className="w-4 h-4 text-ochre shrink-0" />,
    },
    Unreliable: {
      color: "text-accent bg-accent/10 border-accent/30",
      icon: <XCircle className="w-4 h-4 text-accent shrink-0" />,
    },
  }[status] || {
    color: "text-ink-soft bg-paper border-line",
    icon: null,
  };

  return (
    <div className="inline-flex flex-col gap-1.5">
      <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold font-mono ${config.color}`}>
        {config.icon}
        <span>{status}</span>
        {confidence !== undefined && (
          <span className="opacity-75 font-normal">({Math.round(confidence * 100)}%)</span>
        )}
      </div>

      {showDetails && reasons.length > 0 && (
        <ul className="text-xs text-ink-soft space-y-1 list-disc list-inside mt-1">
          {reasons.map((r, i) => (
            <li key={i}>{r}</li>
          ))}
        </ul>
      )}
    </div>
  );
};
