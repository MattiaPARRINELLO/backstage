"use client";

// ============================================================
// Retour d'execution d'une commande (succes ou erreur).
// ============================================================

import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  kind: "success" | "error";
  message: string;
};

export function PaletteFeedback({ kind, message }: Props) {
  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-[var(--r-card)] bg-[var(--surface-1)]/95 backdrop-blur-sm fade-in">
      <div
        className={cn(
          "flex items-center gap-3 px-6 py-4 rounded-[var(--r-tile)]",
          kind === "success"
            ? "text-[var(--success)]"
            : "text-[var(--danger)]"
        )}
      >
        {kind === "success" ? (
          <Check className="w-5 h-5" />
        ) : (
          <X className="w-5 h-5" />
        )}
        <span className="text-[length:var(--t-small)] font-medium">{message}</span>
      </div>
    </div>
  );
}
