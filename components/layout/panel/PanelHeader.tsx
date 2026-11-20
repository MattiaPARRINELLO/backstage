"use client";

import type { ReactNode } from "react";
import { Settings2, X } from "lucide-react";
import { useNow } from "@/lib/clock";
import { formatTime } from "@/lib/date";
import { CONTEXT_LABELS } from "./context-data";

export function PanelHeader({
  activeContext,
  collapsed,
  mobileOpen,
  onToggle,
  children,
}: {
  activeContext: string | null;
  collapsed: boolean;
  mobileOpen: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  const now = useNow();

  return (
    <header className="shrink-0">
      <div className="flex items-center gap-2 h-12 px-4">
        <span className="ui-mono text-[var(--text-3)]">
          {activeContext ? CONTEXT_LABELS[activeContext]?.title ?? "Contexte" : "Panneau"}
        </span>
        {now > 0 && (
          <span className="ui-mono text-[var(--text-4)]">
            {formatTime(new Date(now).toISOString())}
          </span>
        )}
        <button
          onClick={onToggle}
          className="ml-auto w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
          title={mobileOpen ? "Fermer" : collapsed ? "Étendre" : "Réduire"}
          aria-label={mobileOpen ? "Fermer le panneau" : collapsed ? "Étendre le panneau" : "Réduire le panneau"}
        >
          {mobileOpen ? (
            <X className="w-3.5 h-3.5" />
          ) : collapsed ? (
            <Settings2 className="w-3.5 h-3.5" />
          ) : (
            <X className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {children}
    </header>
  );
}
