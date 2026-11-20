"use client";

// ============================================================
// Pied de la palette : rappel des raccourcis clavier.
// ============================================================

import { Sparkles } from "lucide-react";

export function PaletteFooter() {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-t border-[var(--border-1)] bg-[var(--surface-2)]/30">
      <span className="text-[length:var(--t-small)] text-[var(--text-4)] ui-mono flex items-center gap-1.5">
        <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-1)] text-[length:var(--t-small)]">↑</kbd>
        <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-1)] text-[length:var(--t-small)]">↓</kbd>
        Naviguer
      </span>
      <span className="text-[length:var(--t-small)] text-[var(--text-4)] ui-mono flex items-center gap-1.5">
        <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-1)] text-[length:var(--t-small)]">⏎</kbd>
        Exécuter
      </span>
      <span className="text-[length:var(--t-small)] text-[var(--text-4)] ui-mono flex items-center gap-1.5">
        <kbd className="px-1 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border-1)] text-[length:var(--t-small)]">Esc</kbd>
        Fermer
      </span>
      <span className="ml-auto text-[length:var(--t-small)] text-[var(--text-4)] ui-mono flex items-center gap-1">
        <Sparkles className="w-2.5 h-2.5 text-[var(--accent)]" />
        BACKSTAGE
      </span>
    </div>
  );
}
