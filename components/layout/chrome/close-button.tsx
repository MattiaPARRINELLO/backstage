"use client";

// ============================================================
// Bouton de fermeture circulaire, reutilise par les surfaces.
// ============================================================

import { X as XIcon } from "lucide-react";

export function CloseButton({ onClick, label = "Fermer" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="w-9 h-9 rounded-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
    >
      <XIcon className="w-3.5 h-3.5" />
    </button>
  );
}
