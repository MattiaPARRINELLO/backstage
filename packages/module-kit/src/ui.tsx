import type { HTMLAttributes, ReactNode } from "react";

/**
 * Primitives d'interface revendues par le kit (ADR 0001, decision G).
 *
 * Un module ne les importe jamais depuis le noyau : le kit est le seul point
 * d'entree. Les composants n'ecrivent aucune couleur ni rayon, ils utilisent
 * les classes `.ui-*` et les variables definies par le noyau.
 */

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4 mb-8">
      <div className="min-w-0">
        {eyebrow && <p className="ui-mono text-[var(--text-3)] mb-2">{eyebrow}</p>}
        <h1 className="font-display font-semibold tracking-[-0.03em] text-[length:var(--t-head)] leading-[1.02] text-[var(--text-1)] text-balance">
          {title}
        </h1>
        {description && (
          <p className="text-[length:var(--t-body)] text-[var(--text-2)] mt-3 max-w-[34rem] leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-6 py-16">
      {icon && <div className="mb-4 text-[var(--text-3)]">{icon}</div>}
      <h3 className="font-display font-semibold tracking-[-0.03em] text-[length:var(--t-lead)] text-[var(--text-1)] mb-1.5">
        {title}
      </h3>
      {description && (
        <p className="text-[length:var(--t-small)] text-[var(--text-3)] max-w-[28rem] leading-relaxed">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

const SKELETON_BASE =
  "rounded-[var(--r-sm)] bg-[var(--surface-2)] border border-[var(--border-1)] animate-pulse";

export function Skeleton({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div className={className ? `${SKELETON_BASE} ${className}` : SKELETON_BASE} {...rest} />;
}

export function SkeletonLines({
  lines = 3,
  lastWidth = "60%",
}: {
  lines?: number;
  lastWidth?: string;
}) {
  return (
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          style={i === lines - 1 ? { width: lastWidth } : undefined}
        />
      ))}
    </div>
  );
}
