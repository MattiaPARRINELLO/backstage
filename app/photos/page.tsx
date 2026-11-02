"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  loadPhotoShoots, createPhotoShoot, editPhotoShoot, removePhotoShoot,
} from "@/app/actions/photography";
import type { PhotoShoot, PhotoShootsData, PhotoShootStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { STATUS_FLOW } from "./constants";
import { ShootCard } from "./ShootCard";
import { DetailModal } from "./DetailModal";
import { AddShootForm } from "./AddShootForm";
import { GalleryKanban } from "./GalleryKanban";
import { useToast } from "@/components/ui/Toast";

export default function PhotoShootsPage() {
  const [data, setData] = useState<PhotoShootsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useState<"shoots" | "delivery">("shoots");
  const [detailShootId, setDetailShootId] = useState<string | null>(null);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<PhotoShootStatus | null>(null);
  const [mobileStatus, setMobileStatus] = useState<PhotoShootStatus | "all">("all");
  const toast = useToast();

  useEffect(() => {
    loadPhotoShoots()
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  const byStatus = useMemo(() => {
    if (!data) return {} as Record<PhotoShootStatus, PhotoShoot[]>;
    const map: Record<PhotoShootStatus, PhotoShoot[]> = {
      upcoming: [], done: [], on_pc: [], sorted: [], edited: [], exported: [], sent: [],
    };
    for (const s of data.shoots) {
      if (map[s.status]) map[s.status].push(s);
    }
    return map;
  }, [data]);

  const displayedShoots = useMemo(() => {
    if (!data) return [];
    if (mobileStatus === "all") return data.shoots;
    return data.shoots.filter((s) => s.status === mobileStatus);
  }, [data, mobileStatus]);

  const detailShoot = useMemo(
    () => data?.shoots.find((s) => s.id === detailShootId) ?? null,
    [data, detailShootId]
  );

  const handleAdd = async (title: string, date: string, client: string, notes?: string) => {
    startTransition(async () => {
      try {
        const shoot = await createPhotoShoot({ title, date, client, notes });
        setData((prev) => prev ? { shoots: [...prev.shoots, shoot] } : { shoots: [shoot] });
        setShowAdd(false);
      } catch {}
    });
  };

  const handleStatusChange = async (id: string, newStatus: PhotoShootStatus) => {
    const old = data?.shoots.find((s) => s.id === id);
    setData((prev) => prev ? {
      shoots: prev.shoots.map((s) => s.id === id ? { ...s, status: newStatus, updatedAt: new Date().toISOString() } : s),
    } : prev);
    const result = await editPhotoShoot(id, { status: newStatus });
    if (!result) {
      if (old) setData((prev) => prev ? { shoots: prev.shoots.map((s) => s.id === id ? old : s) } : prev);
    }
  };

  const handleUpdateSent = async (id: string, galleryLink: string, photosSent: number) => {
    const old = data?.shoots.find((s) => s.id === id);
    setData((prev) => prev ? {
      shoots: prev.shoots.map((s) => s.id === id ? { ...s, status: "sent", galleryLink, photosSent, updatedAt: new Date().toISOString() } : s),
    } : prev);
    const result = await editPhotoShoot(id, { status: "sent", galleryLink, photosSent });
    if (!result) {
      if (old) setData((prev) => prev ? { shoots: prev.shoots.map((s) => s.id === id ? old : s) } : prev);
    }
  };

  const handleEdit = async (id: string, updates: Partial<{ title: string; date: string; client: string; notes: string }>) => {
    const old = data?.shoots.find((s) => s.id === id);
    setData((prev) => prev ? {
      shoots: prev.shoots.map((s) => s.id === id ? { ...s, ...updates, updatedAt: new Date().toISOString() } : s),
    } : prev);
    const result = await editPhotoShoot(id, updates);
    if (!result) {
      if (old) setData((prev) => prev ? { shoots: prev.shoots.map((s) => s.id === id ? old : s) } : prev);
    }
  };

  const handleDelete = async (id: string) => {
    const old = data?.shoots.find((s) => s.id === id);
    setData((prev) => prev ? { shoots: prev.shoots.filter((s) => s.id !== id) } : prev);
    const ok = await removePhotoShoot(id);
    if (!ok && old) {
      setData((prev) => prev ? { shoots: [...prev.shoots, old] } : prev);
    } else if (ok && old) {
      // Undo : recrée le shooting (nouvel id) si l'utilisateur clique Annuler.
      toast.show({
        message: "Shooting supprimé",
        tone: "info",
        duration: 6000,
        action: {
          label: "Annuler",
          onClick: () => {
            void createPhotoShoot({
              title: old.title,
              date: old.date,
              client: old.client,
              notes: old.notes,
            })
              .then((shoot) => setData((prev) => prev ? { shoots: [...prev.shoots, shoot] } : prev))
              .catch(() => {});
          },
        },
      });
    }
    setDetailShootId(null);
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    setDraggedId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    setDraggedId(null);
    setDragOverCol(null);
  };

  const handleDragOver = (e: React.DragEvent, status: PhotoShootStatus) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(status);
  };

  const handleDragLeave = (status: PhotoShootStatus) => {
    if (dragOverCol === status) setDragOverCol(null);
  };

  const handleDrop = (e: React.DragEvent, status: PhotoShootStatus) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) handleStatusChange(id, status);
    setDraggedId(null);
    setDragOverCol(null);
  };

  return (
    <AppShell>
      <div className="flex h-full min-w-0 flex-col">
        <div className="px-6 pt-6">
          <PageHeader
            title="Photos"
            description="Shootings et livraisons photo au même endroit."
            actions={
              !showAdd && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className="ui-chip"
                      data-active={view === "shoots"}
                      onClick={() => setView("shoots")}
                    >
                      Shootings
                    </button>
                    <button
                      type="button"
                      className="ui-chip"
                      data-active={view === "delivery"}
                      onClick={() => setView("delivery")}
                    >
                      Livraison
                    </button>
                  </div>
                  {view === "shoots" && (
                    <button
                      type="button"
                      className="ui-btn ui-btn--primary gap-2 md:hidden"
                      onClick={() => setShowAdd(true)}
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      Nouveau shooting
                    </button>
                  )}
                </div>
              )
            }
          />
        </div>

        {showAdd && (
          <div className="px-6 pb-4">
            <AddShootForm
              onSubmit={handleAdd}
              onCancel={() => setShowAdd(false)}
            />
          </div>
        )}

        {view === "delivery" ? (
          <div className="min-h-0 flex-1 overflow-y-auto pt-2">
            <GalleryKanban />
          </div>
        ) : loading ? (
          <div className="grid grid-cols-1 gap-6 px-6 pb-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ))}
          </div>
        ) : !data || data.shoots.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <EmptyState
              title="Aucun shooting"
              description="Ajoute ton premier shooting photo pour commencer le suivi."
              action={
                <button
                  type="button"
                  className="ui-btn ui-btn--primary gap-2"
                  onClick={() => setShowAdd(true)}
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  Ajouter un shooting
                </button>
              }
            />
          </div>
        ) : (
          <>
            {/* Desktop : colonnes séparées par l'espace, sans filet lourd. */}
            <div className="hidden min-h-0 flex-1 overflow-x-auto pb-6 md:flex">
              <div className="flex h-full items-start gap-6 px-6 pt-4">
                {STATUS_FLOW.map((col) => {
                  const items = byStatus[col.key];
                  const isOver = dragOverCol === col.key;
                  return (
                    <section
                      key={col.key}
                      className={cn(
                        "flex min-w-[220px] max-w-[260px] flex-1 flex-col rounded-[var(--r-card)] transition-colors",
                        isOver && "bg-[var(--accent)]/5"
                      )}
                      onDragOver={(e) => handleDragOver(e, col.key)}
                      onDragLeave={() => handleDragLeave(col.key)}
                      onDrop={(e) => handleDrop(e, col.key)}
                    >
                      <div className="flex items-baseline gap-2 border-b border-[var(--line)] px-1 pb-2">
                        <h3 className="ui-mono text-[var(--text-3)]">{col.label}</h3>
                        <span className="ui-mono ml-auto text-[var(--text-4)]">{items.length}</span>
                      </div>

                      <div className="min-h-[96px] flex-1 space-y-2.5 py-3">
                        {col.key === "upcoming" && (
                          <button
                            type="button"
                            onClick={() => setShowAdd(true)}
                            className="flex w-full items-center justify-center gap-2 rounded-full border border-dashed border-[var(--line-2)] px-4 py-2.5 text-[var(--t-small)] text-[var(--text-2)] transition-colors hover:border-[var(--text-3)] hover:text-[var(--text-1)]"
                          >
                            <Plus className="h-4 w-4" aria-hidden />
                            Nouveau shooting
                          </button>
                        )}

                        {items.length === 0 && (
                          <div className="flex h-[72px] items-center justify-center rounded-full border border-dashed border-[var(--line)] text-[var(--t-small)] text-[var(--text-4)]">
                            Déposer ici
                          </div>
                        )}
                        {items.map((shoot) => (
                          <div
                            key={shoot.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, shoot.id)}
                            onDragEnd={handleDragEnd}
                            className={cn(
                              "transition-opacity duration-150",
                              draggedId === shoot.id && "opacity-30"
                            )}
                          >
                            <ShootCard
                              shoot={shoot}
                              onStatusChange={(s) => handleStatusChange(shoot.id, s)}
                              onDelete={() => handleDelete(shoot.id)}
                              onUpdateSent={(link, count) => handleUpdateSent(shoot.id, link, count)}
                              onDetail={() => setDetailShootId(shoot.id)}
                            />
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            </div>

            {/* Mobile : puces de filtre + liste */}
            <div className="flex min-h-0 flex-1 flex-col md:hidden">
              <div className="flex shrink-0 gap-1.5 overflow-x-auto px-4 py-3">
                <button
                  type="button"
                  className="ui-chip shrink-0"
                  data-active={mobileStatus === "all"}
                  onClick={() => setMobileStatus("all")}
                >
                  Tous
                </button>
                {STATUS_FLOW.map((col) => (
                  <button
                    key={col.key}
                    type="button"
                    className="ui-chip shrink-0"
                    data-active={mobileStatus === col.key}
                    onClick={() => setMobileStatus(col.key)}
                  >
                    {col.label}
                  </button>
                ))}
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto px-4 pb-4">
                {displayedShoots.map((shoot) => (
                  <ShootCard
                    key={shoot.id}
                    shoot={shoot}
                    onStatusChange={(s) => handleStatusChange(shoot.id, s)}
                    onDelete={() => handleDelete(shoot.id)}
                    onUpdateSent={(link, count) => handleUpdateSent(shoot.id, link, count)}
                    onDetail={() => setDetailShootId(shoot.id)}
                  />
                ))}
                {displayedShoots.length === 0 && (
                  <p className="py-12 text-center text-[var(--t-small)] text-[var(--text-4)]">
                    Aucun shooting dans ce statut
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {detailShoot && (
        <DetailModal
          shoot={detailShoot}
          onClose={() => setDetailShootId(null)}
          onEdit={(updates) => handleEdit(detailShoot.id, updates)}
          onDelete={() => handleDelete(detailShoot.id)}
        />
      )}
    </AppShell>
  );
}
