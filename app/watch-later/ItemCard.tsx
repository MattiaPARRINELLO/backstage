"use client";

import { Trash2, GripVertical, ExternalLink } from "lucide-react";
import type { WatchLaterItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatRelative } from "@/lib/date";
import { categoryMeta } from "./meta";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function ItemCard({
  item,
  isDragging,
  isDragOver,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  item: WatchLaterItem;
  isDragging: boolean;
  isDragOver: boolean;
  onDelete: () => void;
  onDragStart: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDrop: (e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  const meta = categoryMeta[item.category];
  const host = hostOf(item.url);

  return (
    <article
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={cn(
        "group flex cursor-grab items-start gap-3 border-b border-[var(--line)] px-1 py-3 transition-colors active:cursor-grabbing",
        isDragging && "opacity-40",
        isDragOver && "bg-[var(--surface-2)]"
      )}
    >
      <span className="mt-0.5 shrink-0 text-[var(--text-4)] opacity-0 transition-opacity group-hover:opacity-100">
        <GripVertical className="h-4 w-4" aria-hidden />
      </span>

      <div className="min-w-0 flex-1">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className="block"
        >
          <h3 className="truncate text-[length:var(--t-body)] font-medium text-[var(--text-1)] transition-colors group-hover:text-[var(--accent)]">
            {item.title}
          </h3>
          {item.description && (
            <p className="mt-0.5 line-clamp-1 text-[length:var(--t-small)] leading-relaxed text-[var(--text-3)]">
              {item.description}
            </p>
          )}
          <p className="ui-mono mt-1 flex items-center gap-2 text-[var(--text-4)]">
            <span className="truncate">{host}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0">{meta.label}</span>
            <span aria-hidden>·</span>
            <span className="shrink-0">{formatRelative(item.createdAt)}</span>
          </p>
        </a>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          draggable={false}
          onDragStart={(e) => e.preventDefault()}
          className="ui-btn ui-btn--text gap-1"
        >
          Ouvrir
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
        <button
          type="button"
          onClick={onDelete}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-4)] opacity-60 transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--danger)] focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
          title="Supprimer"
          aria-label="Supprimer"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </article>
  );
}
