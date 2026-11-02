"use client";

import { Pencil, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui/IconButton";
import type { MemoryFact } from "@/lib/types";

export function FactRow({ fact, onEdit, onDelete }: { fact: MemoryFact; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="group flex items-start gap-3 border-b border-[var(--line)] py-3">
      <div className="min-w-0 flex-1">
        <p className="text-[length:var(--t-body)] leading-relaxed text-[var(--text-1)]">
          {fact.content}
        </p>
        {fact.source === "auto-extract" && fact.confidence !== undefined && (
          <p className="ui-mono mt-1 text-[var(--text-4)]">
            mémorisé auto · confiance {Math.round(fact.confidence * 100)}%
          </p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-1 opacity-60 transition-opacity focus-within:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
        <IconButton label="Modifier" onClick={onEdit}>
          <Pencil className="h-3 w-3" />
        </IconButton>
        <IconButton label="Supprimer" tone="danger" onClick={onDelete}>
          <Trash2 className="h-3 w-3" />
        </IconButton>
      </div>
    </div>
  );
}
