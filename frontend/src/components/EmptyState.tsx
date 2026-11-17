import React from "react";
import { Link } from "react-router-dom";
import { Inbox, ArrowRight } from "lucide-react";

interface EmptyStateProps {
  title: string;
  description: string;
  actionText?: string;
  actionHref?: string;
  icon?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  actionText,
  actionHref,
  icon,
}) => {
  return (
    <div className="card-paper p-10 text-center max-w-xl mx-auto my-8 border border-line bg-paper-raised">
      <div className="w-12 h-12 rounded-full bg-paper flex items-center justify-center mx-auto mb-4 text-ink-soft border border-line">
        {icon || <Inbox className="w-6 h-6" />}
      </div>
      <h3 className="font-serif text-xl font-semibold text-ink mb-2">{title}</h3>
      <p className="text-ink-soft text-sm leading-relaxed mb-6">{description}</p>
      {actionText && actionHref && (
        <Link to={actionHref} className="btn-primary inline-flex items-center gap-2">
          <span>{actionText}</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      )}
    </div>
  );
};
