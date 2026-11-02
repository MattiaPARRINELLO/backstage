"use client";

import { useState, useTransition, useEffect, useMemo } from "react";
import { Plus, Brain, Search, Share2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { loadBrain, loadMemoryRelationships, rememberFact, editMemoryFact, forgetFact } from "@/app/actions/brain";
import dynamic from "next/dynamic";
import type { MemoryData, MemoryCategory, MemoryRelationship } from "@/lib/types";
import { categoryMeta, ALL_FILTERS, groupByCategory, type Filter } from "./memory-utils";
import { ProfileCard } from "./ProfileCard";
import { FactRow } from "./FactRow";
import { EditFactForm, AddFactForm } from "./FactForms";

const KnowledgeGraph = dynamic(
  () => import("@/components/brain/KnowledgeGraph").then((m) => ({ default: m.KnowledgeGraph })),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[600px] items-center justify-center rounded-[var(--r-card)] border border-[var(--line)] text-[var(--t-body)] text-[var(--text-2)]">
        Chargement du graphe…
      </div>
    ),
  }
);

export default function BrainPage() {
  const [data, setData] = useState<MemoryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<"facts" | "graph">("facts");
  const [relationships, setRelationships] = useState<MemoryRelationship[]>([]);
  const toast = useToast();

  useEffect(() => {
    Promise.resolve().then(() => {
      startTransition(async () => {
        try {
          const [d, rels] = await Promise.all([loadBrain(), loadMemoryRelationships()]);
          setData(d);
          setRelationships(rels);
        } finally {
          setLoading(false);
        }
      });
    });
  }, []);

  const handleDelete = (id: string) => {
    if (!data) return;
    const fact = data.facts.find((f) => f.id === id);
    if (!fact) return;
    setData({ ...data, facts: data.facts.filter((f) => f.id !== id) });
    const toastId = toast.show({
      message: `Fait supprimé : "${fact.content.slice(0, 60)}${fact.content.length > 60 ? "…" : ""}"`,
      tone: "default",
      duration: 5000,
      action: {
        label: "Annuler",
        onClick: () => {
          setData((prev) => (prev ? { ...prev, facts: [...prev.facts, fact] } : prev));
          void rememberFact(fact.content, fact.category, { source: fact.source, confidence: fact.confidence }).then((restored) => {
            if (data) {
              setData((prev) =>
                prev
                  ? { ...prev, facts: prev.facts.map((f) => (f.id === id ? restored : f)) }
                  : prev
              );
            }
            toast.dismiss(toastId);
            toast.show({ message: "Fait restauré", tone: "success", duration: 2400 });
          });
        },
      },
    });
    void forgetFact(id);
  };

  const handleSaveEdit = (id: string, content: string, category: MemoryCategory) => {
    startTransition(async () => {
      const updated = await editMemoryFact(id, { content, category });
      if (updated && data) {
        setData({
          ...data,
          facts: data.facts.map((f) => (f.id === id ? updated : f)),
        });
        toast.show({ message: "Fait mis à jour", tone: "success", duration: 2200 });
      }
      setEditing(null);
    });
  };

  const handleAdd = (content: string, category: MemoryCategory) => {
    startTransition(async () => {
      await rememberFact(content, category, { source: "manual" });
      // `rememberFact` appelle `revalidatePath` : l'état local peut être écrasé
      // par le rafraîchissement RSC avant d'être mis à jour. On relit donc la
      // source de vérité — sinon le fait est écrit mais invisible jusqu'au
      // prochain chargement.
      const fresh = await loadBrain();
      setData(fresh);
      toast.show({ message: "Fait mémorisé", tone: "success", duration: 2200 });
      setShowAdd(false);
    });
  };

  const grouped = useMemo(() => groupByCategory(data?.facts ?? []), [data]);
  const counts = useMemo(
    () => ({
      dev: grouped.dev?.length ?? 0,
      photo: grouped.photo?.length ?? 0,
      life: grouped.life?.length ?? 0,
      preference: grouped.preference?.length ?? 0,
    }),
    [grouped]
  );

  const filteredFacts = useMemo(() => {
    if (!data) return [];
    const q = search.trim().toLowerCase();
    return data.facts.filter((f) => {
      if (filter !== "all" && f.category !== filter) return false;
      if (!q) return true;
      return f.content.toLowerCase().includes(q);
    });
  }, [data, filter, search]);

  const filteredGrouped = useMemo(() => groupByCategory(filteredFacts), [filteredFacts]);

  return (
    <AppShell>
      <div className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
          <PageHeader
            title="Cerveau"
            description="Tout ce que l'IA sait de toi. Modifie ou supprime ce qui ne te représente plus. L'IA utilise ces faits pour personnaliser ses réponses."
            actions={
              <button
                type="button"
                className="ui-btn ui-btn--primary gap-2"
                onClick={() => setShowAdd(true)}
              >
                <Plus className="h-4 w-4" aria-hidden />
                Ajouter un fait
              </button>
            }
          />

          <div className="mb-6 flex items-center gap-1.5">
            <button
              type="button"
              className="ui-chip gap-2"
              data-active={tab === "facts"}
              onClick={() => setTab("facts")}
            >
              <Brain className="h-3.5 w-3.5" aria-hidden />
              Faits
            </button>
            <button
              type="button"
              className="ui-chip gap-2"
              data-active={tab === "graph"}
              onClick={() => setTab("graph")}
            >
              <Share2 className="h-3.5 w-3.5" aria-hidden />
              Graphe
            </button>
          </div>

          {tab === "graph" && data ? (
            <div className="h-[600px] overflow-hidden rounded-[var(--r-card)] border border-[var(--line)]">
              <KnowledgeGraph
                key={data.facts.length}
                facts={data.facts}
                relationships={relationships}
                onEditFact={(id) => { setEditing(id); setTab("facts"); }}
              />
            </div>
          ) : (
            <>
              {showAdd && (
                <AddFactForm
                  onCancel={() => setShowAdd(false)}
                  onSubmit={handleAdd}
                />
              )}

              {data && <ProfileCard profile={data.profile} />}

              {loading && !data && (
                <div className="space-y-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-12" />
                  ))}
                </div>
              )}

              {data && data.facts.length === 0 && (
                <EmptyState
                  title="Aucune mémoire pour l'instant"
                  description="L'IA peut mémoriser des faits à ta place via le chat, ou tu peux les ajouter manuellement ici."
                />
              )}

              {data && data.facts.length > 0 && (
                <div className="space-y-5">
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="ui-field min-w-[200px] flex-1">
                      <Search className="h-4 w-4 shrink-0 text-[var(--text-3)]" aria-hidden />
                      <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Rechercher dans la mémoire…"
                        aria-label="Rechercher dans la mémoire"
                        className="min-w-0 flex-1 bg-transparent text-base outline-none"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {ALL_FILTERS.map((f) => {
                        const active = filter === f.id;
                        const count = f.id === "all" ? data.facts.length : counts[f.id as MemoryCategory] ?? 0;
                        return (
                          <button
                            key={f.id}
                            type="button"
                            className="ui-chip"
                            data-active={active}
                            onClick={() => setFilter(f.id)}
                          >
                            {f.label}
                            <span className="ui-mono opacity-60">{count}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {filteredFacts.length === 0 && (
                    <p className="py-10 text-center text-[length:var(--t-small)] text-[var(--text-4)]">
                      Aucun fait ne correspond à ta recherche.
                    </p>
                  )}

                  {filteredFacts.length > 0 && (
                    <div className="space-y-8">
                      {(Object.keys(categoryMeta) as MemoryCategory[]).map((cat) => {
                        const facts = filteredGrouped[cat] ?? [];
                        if (facts.length === 0) return null;
                        const meta = categoryMeta[cat];
                        return (
                          <section key={cat}>
                            <div className="mb-1 flex items-baseline gap-2 border-b border-[var(--line-2)] pb-2">
                              <h2 className="font-display text-[length:var(--t-lead)] font-semibold text-[var(--text-1)]">
                                {meta.label}
                              </h2>
                              <span className="ui-mono text-[var(--text-4)]">{facts.length}</span>
                            </div>
                            <div>
                              {facts.map((fact) =>
                                editing === fact.id ? (
                                  <EditFactForm
                                    key={fact.id}
                                    fact={fact}
                                    onCancel={() => setEditing(null)}
                                    onSave={handleSaveEdit}
                                  />
                                ) : (
                                  <FactRow
                                    key={fact.id}
                                    fact={fact}
                                    onEdit={() => setEditing(fact.id)}
                                    onDelete={() => handleDelete(fact.id)}
                                  />
                                )
                              )}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </AppShell>
  );
}
