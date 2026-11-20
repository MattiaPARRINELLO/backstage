"use client";

import { cn } from "@/lib/utils";
import { CONTEXT_LABELS } from "./context-data";

export function ContextBadge({ contextKey, running }: { contextKey: string; running: boolean }) {
  const meta = CONTEXT_LABELS[contextKey];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent)]/10">
      <Icon className={cn("w-3 h-3 text-[var(--accent)]", running && "animate-pulse")} />
      <span className="ui-mono text-[var(--accent)]">
        {meta.title}
      </span>
    </div>
  );
}
