"use client";

import { useEffect, useState, useTransition, useMemo, useRef, useCallback } from "react";
import { Plus, Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import {
  loadWatchLater,
  createWatchLaterItem,
  removeWatchLaterItem,
  reorderWatchLater,
} from "@/app/actions/watch-later";
import type { WatchLaterCategory, WatchLaterItem } from "@/lib/types";
import { FILTER_ORDER, type FilterId } from "./meta";
import { ItemCard } from "./ItemCard";
import { AddItemForm } from "./AddItemForm";

export default function WatchLaterPage() {
  const [items, setItems] = useState<WatchLaterItem[] | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [showAdd, setShowAdd] = useState(false);
  const [, startTransition] = useTransition();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragSnapshotRef = useRef<WatchLaterItem[] | null>(null);
  const toast = useToast();

  useEffect(() => {
    startTransition(async () => {
      const d = await loadWatchLater();
      setItems(d.items);
    });
  }, []);

  const handleCreate = (input: { url: string; title: string; description?: string; category?: WatchLaterCategory }) => {
    startTransition(async () => {
      const item = await createWatchLaterItem(input);
      setItems((prev) => (prev ? [item, ...prev] : [item]));
      setShowAdd(false);
      toast.show({ message: "Lien ajouté à À voir", tone: "success", duration: 2200 });
    });
  };

  const handleDelete = (id: string) => {
    if (!items) return;
    const item = items.find((i) => i.id === id);
    if (!item) return;
    setItems((prev) => (prev ?? []).filter((x) => x.id !== id));
    const toastId = toast.show({
      message: `Retiré : "${item.title.slice(0, 50)}${item.title.length > 50 ? "…" : ""}"`,
      tone: "default",
      duration: 5000,
      action: {
        label: "Annuler",
        onClick: () => {
          setItems((prev) => (prev ? [item, ...prev] : [item]));
          void createWatchLaterItem({
            url: item.url,
            title: item.title,
            description: item.description,
            category: item.category,
            source: item.source,
          }).then((restored) => {
            setItems((prev) =>
              prev ? prev.map((x) => (x.id === id ? restored : x)) : prev
            );
            toast.dismiss(toastId);
            toast.show({ message: "Lien restauré", tone: "success", duration: 2000 });
          });
        },
      },
    });
    void removeWatchLaterItem(id);
  };

  const persistOrder = useCallback(
    (next: WatchLaterItem[]) => {
      setItems(next);
      const orderedIds = next.map((i) => i.id);
      void reorderWatchLater(orderedIds);
    },
    []
  );

  const handleDragStart = (id: string, currentItems: WatchLaterItem[]) => {
    dragSnapshotRef.current = currentItems;
    setDraggingId(id);
  };

  const handleDragOver = (e: React.DragEvent, overId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (overId !== dragOverId) setDragOverId(overId);
  };

  const handleDrop = (e: React.DragEvent, dropId: string) => {
    e.preventDefault();
    const dragId = draggingId;
    setDraggingId(null);
    setDragOverId(null);
    if (!dragId || dragId === dropId) return;
    const snap = dragSnapshotRef.current;
    if (!snap) return;
    const fromIdx = snap.findIndex((i) => i.id === dragId);
    const toIdx = snap.findIndex((i) => i.id === dropId);
    if (fromIdx < 0 || toIdx < 0) return;
    const next = [...snap];
    const [moved] = next.splice(fromIdx, 1);
    next.splice(toIdx, 0, moved);
    persistOrder(next);
  };

  const handleDragEnd = () => {
    setDraggingId(null);
    setDragOverId(null);
    dragSnapshotRef.current = null;
  };

  const filtered = useMemo(() => {
    if (!items) return [];
    return items.filter((item) => {
      if (filter !== "all" && item.category !== filter) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          item.title.toLowerCase().includes(q) ||
          item.description?.toLowerCase().includes(q) ||
          item.source.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [items, filter, query]);

  const counts = useMemo(() => {
    if (!items) return {} as Record<FilterId, number>;
    const c: Record<string, number> = { all: items.length };
    for (const it of items) {
      c[it.category] = (c[it.category] ?? 0) + 1;
    }
    return c as Record<FilterId, number>;
  }, [items]);

  return (
    <AppShell>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <PageHeader
            title="À voir plus tard"
            description="Liens que tu as partagés avec l'IA ou ajoutés à la main. Filtre par catégorie, retrouve tout au même endroit. Glisse les lignes pour réorganiser."
            actions={
              <button
                type="button"
                className="ui-btn ui-btn--primary gap-2"
                onClick={() => setShowAdd(true)}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Ajouter un lien
              </button>
            }
          />

          {showAdd && (
            <AddItemForm
              onCancel={() => setShowAdd(false)}
              onSubmit={handleCreate}
            />
          )}

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {FILTER_ORDER.map(({ id, label }) => {
                const active = filter === id;
                const count = counts[id] ?? 0;
                return (
                  <button
                    key={id}
                    type="button"
                    className="ui-chip shrink-0"
                    data-active={active}
                    onClick={() => setFilter(id)}
                  >
                    {label}
                    <span className="ui-mono opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>
            <div className="ui-field min-w-[200px] max-w-xs flex-1">
              <Search className="h-4 w-4 shrink-0 text-[var(--text-3)]" aria-hidden />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filtrer par titre ou source…"
                aria-label="Filtrer les liens"
                className="min-w-0 flex-1 bg-transparent text-base outline-none"
              />
            </div>
          </div>

          {items === null ? (
            <div className="border-t border-[var(--line)]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="border-b border-[var(--line)] py-4">
                  <Skeleton className="h-10" />
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            items.length === 0 ? (
              <EmptyState
                title="Aucun lien enregistré"
                description="Partage un lien à l'IA dans le chat — elle l'ajoutera automatiquement. Ou ajoute-le ici."
              />
            ) : (
              <EmptyState
                title="Aucun résultat"
                description="Aucun élément ne correspond à ce filtre. Essaie une autre catégorie."
              />
            )
          ) : (
            <div className="border-t border-[var(--line)]">
              {filtered.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  isDragging={draggingId === item.id}
                  isDragOver={dragOverId === item.id && draggingId !== item.id}
                  onDelete={() => handleDelete(item.id)}
                  onDragStart={() => items && handleDragStart(item.id, items)}
                  onDragOver={(e) => handleDragOver(e, item.id)}
                  onDrop={(e) => handleDrop(e, item.id)}
                  onDragEnd={handleDragEnd}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
