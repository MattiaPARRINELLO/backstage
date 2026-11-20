"use client";

// ============================================================
// Palette de commandes (Cmd+K / Ctrl+K).
// L'etat vit dans `useCommandPalette`, le corps et le pied dans
// `command-palette/`. Ce fichier ne garde que la coquille.
// ============================================================

import { Command, Search, X } from "lucide-react";
import { useCommandPalette } from "@/components/ui/command-palette/use-command-palette";
import { PaletteResults } from "@/components/ui/command-palette/palette-results";
import { PaletteFeedback } from "@/components/ui/command-palette/palette-feedback";
import { PaletteFooter } from "@/components/ui/command-palette/palette-footer";

export function CommandPalette() {
  const {
    open,
    input,
    setInput,
    setSelectedIdx,
    busy,
    feedback,
    inputRef,
    listRef,
    results,
    safeIdx,
    executeSelected,
    handleKeyDown,
    close,
    pickPrefix,
  } = useCommandPalette();

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Palette de commandes"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={close}
      />

      {/* Card */}
      <div className="relative w-full max-w-xl mx-4 rounded-[var(--r-card)] border border-[var(--border-2)] bg-[var(--surface-1)] overflow-hidden slide-up">
        {/* Feedback overlay */}
        {feedback && (
          <PaletteFeedback kind={feedback.kind} message={feedback.message} />
        )}

        {/* Input row */}
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[var(--border-1)]">
          {busy ? (
            <span className="w-4 h-4 rounded-full border-2 border-[var(--accent)] border-r-transparent animate-spin shrink-0" />
          ) : (
            <Search className="w-4 h-4 text-[var(--text-3)] shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setSelectedIdx(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher ou utiliser une commande…"
            className="flex-1 bg-transparent border-none outline-none text-[length:var(--t-small)] text-[var(--text-1)] placeholder:text-[var(--text-4)]"
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-[var(--r-sm)] bg-[var(--surface-2)] border border-[var(--border-1)] text-[length:var(--t-small)] text-[var(--text-4)] ui-mono">
            <Command className="w-2.5 h-2.5" />
            K
          </kbd>
          <button
            onClick={close}
            className="w-10 h-10 -mr-2 rounded-[var(--r-sm)] flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <PaletteResults
          results={results}
          safeIdx={safeIdx}
          query={input}
          hasFeedback={feedback !== null}
          listRef={listRef}
          onSelect={(idx) => {
            setSelectedIdx(idx);
            executeSelected();
          }}
          onHover={setSelectedIdx}
          onPickPrefix={pickPrefix}
        />

        <PaletteFooter />
      </div>
    </div>
  );
}
