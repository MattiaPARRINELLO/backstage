"use client";

import { useEffect, useState } from "react";
import { EmptyState } from "@/components/layout/Chrome";
import { Skeleton } from "@/components/ui/Skeleton";
import { ArrowRight } from "lucide-react";
import type { GalleryItem, GalleryStatus } from "@/lib/types";

const STATUS_LABELS: Record<GalleryStatus, string> = {
  shooted: "Shooted",
  selecting: "Selecting",
  editing: "Editing",
  delivered: "Delivered",
};

// Kanban de livraison (gallery.json), intégré à la page Photos : une seule
// entrée « Photos » dans la navigation, deux vues (Shootings / Livraison).
export function GalleryKanban() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGalleryItems().then(setItems).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 px-6 pb-6 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-48 rounded-[var(--r-tile)]" />)}
      </div>
    );
  }

  const columns: GalleryStatus[] = ["shooted", "selecting", "editing", "delivered"];

  if (items.length === 0) {
    return (
      <div className="px-6 pb-6">
        <EmptyState title="Galerie vide" description="Aucune galerie de livraison pour le moment. Les concerts shootés apparaîtront ici." />
      </div>
    );
  }

  return (
    <div className="px-6 pb-6">
      <div className="grid grid-cols-1 items-start gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {columns.map((status) => {
          const columnItems = items.filter((g) => g.status === status);
          return (
            <section key={status}>
              <div className="flex items-baseline gap-2 border-b border-[var(--line)] px-1 pb-2">
                <h2 className="ui-mono text-[var(--text-3)]">{STATUS_LABELS[status]}</h2>
                <span className="ui-mono ml-auto text-[var(--text-4)]">{columnItems.length}</span>
              </div>

              <div className="space-y-2.5 pt-3">
                {columnItems.length === 0 && (
                  <div className="flex h-[72px] items-center justify-center rounded-full border border-dashed border-[var(--line)] text-[var(--t-small)] text-[var(--text-4)]">
                    Vide
                  </div>
                )}

                {columnItems.map((g) => {
                  const late = g.deadline ? new Date(g.deadline) < new Date() : false;
                  return (
                    <article key={g.id} className="ui-tile p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[var(--r-sm)] bg-[var(--surface-2)]">
                          <span className="font-display text-[length:var(--t-body)] font-semibold leading-none text-[var(--text-1)]">
                            {g.totalPhotos}
                          </span>
                          <span className="ui-mono leading-none text-[var(--text-3)]">photos</span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="truncate text-[length:var(--t-body)] font-medium text-[var(--text-1)]">
                            {g.title}
                          </h3>
                          <p className="ui-mono text-[var(--text-3)]">
                            {g.selectedPhotos} sélectionnées
                          </p>
                        </div>
                      </div>

                      <dl className="mt-3 space-y-1 border-t border-[var(--line)] pt-2">
                        <div className="flex items-baseline justify-between gap-2">
                          <dt className="ui-label">Éditées</dt>
                          <dd className="ui-mono text-[var(--text-2)]">{g.editedPhotos}</dd>
                        </div>
                        {g.deliveredTo && (
                          <div className="flex items-baseline justify-between gap-2">
                            <dt className="ui-label">Envoyé à</dt>
                            <dd className="ui-mono truncate text-[var(--text-2)]">{g.deliveredTo}</dd>
                          </div>
                        )}
                        {g.deadline && (
                          <div className="flex items-baseline justify-between gap-2">
                            <dt className="ui-label">Échéance</dt>
                            <dd
                              className={
                                late
                                  ? "ui-mono text-[var(--danger)]"
                                  : "ui-mono text-[var(--text-2)]"
                              }
                            >
                              {new Date(g.deadline).toLocaleDateString("fr-FR")}
                            </dd>
                          </div>
                        )}
                      </dl>

                      {status !== "delivered" && (
                        <button
                          type="button"
                          className="ui-btn ui-btn--text mt-2 gap-1"
                          onClick={() => moveItem(g.id, status, columns[columns.indexOf(status) + 1])}
                        >
                          Avancer
                          <ArrowRight className="h-3 w-3" aria-hidden />
                        </button>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

async function loadGalleryItems(): Promise<GalleryItem[]> {
  const res = await fetch("/api/gallery");
  if (!res.ok) return [];
  const data = await res.json();
  return data.items ?? [];
}

async function moveItem(id: string, from: GalleryStatus, to: GalleryStatus) {
  await fetch("/api/gallery", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, status: to }),
  });
  window.location.reload();
}
