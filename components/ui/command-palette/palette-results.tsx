"use client";

// ============================================================
// Corps de la palette : resultats filtres, commandes disponibles
// et etat vide.
// ============================================================

import { ArrowRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { COMMANDS } from "./commands";
import type { ResultItem } from "./types";

type Props = {
  results: ResultItem[];
  safeIdx: number;
  query: string;
  hasFeedback: boolean;
  listRef: React.RefObject<HTMLDivElement | null>;
  onSelect: (idx: number) => void;
  onHover: (idx: number) => void;
  onPickPrefix: (prefix: string) => void;
};

export function PaletteResults({
  results,
  safeIdx,
  query,
  hasFeedback,
  listRef,
  onSelect,
  onHover,
  onPickPrefix,
}: Props) {
  return (
    <>
      {/* Results list */}
      {results.length > 0 && (
        <div
          ref={listRef}
          className="max-h-[340px] overflow-y-auto p-2 space-y-0.5"
          onMouseMove={() => {
            /* reset keyboard selection on mouse hover */
          }}
        >
          {results.map((item, idx) => {
            const Icon = item.icon;
            const selected = idx === safeIdx;

            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelect(idx);
                }}
                onMouseEnter={() => onHover(idx)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-sm)] text-left transition-colors duration-150",
                  selected
                    ? "bg-[var(--accent)]/10 text-[var(--accent)] ring-1 ring-[var(--accent)]/20"
                    : "text-[var(--text-1)] hover:bg-[var(--surface-2)]"
                )}
              >
                <div
                  className={cn(
                    "w-8 h-8 rounded-[var(--r-sm)] flex items-center justify-center border shrink-0 transition-colors",
                    selected
                      ? "border-[var(--accent)]/30 bg-[var(--accent)]/10"
                      : "border-[var(--border-1)] bg-[var(--surface-2)]"
                  )}
                >
                  <Icon
                    className={cn(
                      "w-4 h-4",
                      selected ? "text-[var(--accent)]" : "text-[var(--text-3)]"
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[length:var(--t-small)] font-medium truncate">{item.label}</p>
                  <p className="text-[length:var(--t-small)] text-[var(--text-3)] truncate">
                    {item.description}
                  </p>
                </div>
                <kbd className="shrink-0 px-1.5 py-0.5 rounded text-[length:var(--t-small)] ui-mono bg-[var(--surface-2)] border border-[var(--border-1)] text-[var(--text-4)]">
                  {item.badge}
                </kbd>
              </button>
            );
          })}
        </div>
      )}

      {/* Empty state : no input  */}
      {!query.trim() && results.length === 0 && (
        <div className="p-3">
          <p className="px-3 pb-2 text-[length:var(--t-small)] font-semibold  text-[var(--text-4)] ui-mono">
            Commandes disponibles
          </p>
          {COMMANDS.map((cmd) => {
            const Icon = cmd.icon;
            return (
              <button
                key={cmd.id}
                onClick={() => onPickPrefix(cmd.prefix)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-[var(--r-sm)] text-left transition-colors duration-150 text-[var(--text-1)] hover:bg-[var(--surface-2)] group"
              >
                <div className="w-8 h-8 rounded-[var(--r-sm)] flex items-center justify-center border border-[var(--border-1)] bg-[var(--surface-2)] shrink-0 group-hover:border-[var(--border-2)] transition-colors">
                  <Icon className="w-4 h-4 text-[var(--text-3)]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[length:var(--t-small)] font-medium truncate">{cmd.label}</p>
                  <p className="text-[length:var(--t-small)] text-[var(--text-3)] truncate">
                    {cmd.description}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <kbd className="shrink-0 px-1.5 py-0.5 rounded text-[length:var(--t-small)] ui-mono bg-[var(--surface-2)] border border-[var(--border-1)] text-[var(--text-4)]">
                    {cmd.prefix}
                  </kbd>
                  <ArrowRight className="w-3 h-3 text-[var(--text-4)] opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* No results for query */}
      {query.trim() && results.length === 0 && !hasFeedback && (
        <div className="flex flex-col items-center justify-center py-10 px-4">
          <Search className="w-6 h-6 text-[var(--text-4)] mb-3" />
          <p className="text-[length:var(--t-small)] text-[var(--text-3)]">Aucune commande trouvée</p>
          <p className="text-[length:var(--t-small)] text-[var(--text-4)] mt-1 text-center">
            Essayez <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-1)] text-[length:var(--t-small)] ui-mono">/todo</kbd>,{" "}
            <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-1)] text-[length:var(--t-small)] ui-mono">/remember</kbd>,{" "}
            <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-1)] text-[length:var(--t-small)] ui-mono">/concert</kbd>,{" "}
            <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-1)] text-[length:var(--t-small)] ui-mono">/search</kbd>
          </p>
        </div>
      )}
    </>
  );
}
