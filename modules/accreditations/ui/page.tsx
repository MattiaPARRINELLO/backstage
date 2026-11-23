"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { RefreshCw, Search, Ticket } from "lucide-react";
import {
  EmptyState,
  PageHeader,
  Skeleton,
  useModuleAction,
  useModuleToasts,
} from "@backstage/module-kit";

import type { Accreditation, AccreditationStatus } from "../schema";
import { AccreditationRow } from "./AccreditationRow";
import { accreditationsApi, type AccreditationEditInput } from "./api";
import {
  FILTER_ORDER,
  countByStatus,
  describeActionError,
  filterAccreditations,
  sortAccreditations,
  type FilterId,
} from "./meta";

export default function AccreditationsPage() {
  const [items, setItems] = useState<Accreditation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterId>("all");
  const [query, setQuery] = useState("");
  const [scanning, setScanning] = useState(false);
  const [, startTransition] = useTransition();
  const call = useModuleAction();
  const api = useMemo(() => accreditationsApi(call), [call]);
  const toast = useModuleToasts();
  // L'invocation fournie par le noyau n'est pas referentiellement stable : sans
  // ce garde, l'effet relancerait un chargement a chaque rendu.
  const loadedRef = useRef(false);

  const reload = useCallback(async () => {
    try {
      const data = await api.load();
      setItems(data.accreditations);
      setError(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Impossible de charger les accréditations"
      );
    }
  }, [api]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    startTransition(() => {
      void reload();
    });
  }, [reload]);

  const sorted = useMemo(() => sortAccreditations(items ?? []), [items]);
  const filtered = useMemo(
    () => filterAccreditations(sorted, filter, query),
    [sorted, filter, query]
  );
  const counts = useMemo(() => countByStatus(items ?? []), [items]);

  async function handleScan() {
    setScanning(true);
    try {
      const result = await api.scan();
      toast?.show({
        message: result.text,
        tone: result.status === "error" ? "danger" : "success",
        duration: 5000,
      });
      await reload();
    } catch (cause) {
      toast?.show({
        message: cause instanceof Error ? cause.message : "Scan impossible",
        tone: "danger",
      });
    } finally {
      setScanning(false);
    }
  }

  async function handleStatus(id: string, status: AccreditationStatus) {
    try {
      const updated = await api.updateStatus(id, status);
      if (!updated) {
        toast?.show({ message: "Fiche introuvable, statut non modifié", tone: "danger" });
        return;
      }
      setItems((prev) =>
        prev ? prev.map((entry) => (entry.id === id ? updated : entry)) : prev
      );
    } catch (cause) {
      toast?.show({
        message: describeActionError(cause, "Statut non modifié"),
        tone: "danger",
      });
    }
  }

  async function handleSave(input: AccreditationEditInput): Promise<boolean> {
    try {
      const updated = await api.edit(input);
      if (!updated) {
        toast?.show({ message: "Fiche introuvable, modification non enregistrée", tone: "danger" });
        return false;
      }
      setItems((prev) =>
        prev ? prev.map((entry) => (entry.id === input.id ? updated : entry)) : prev
      );
      toast?.show({ message: "Fiche mise à jour", tone: "success", duration: 2000 });
      return true;
    } catch (cause) {
      toast?.show({
        message: describeActionError(cause, "Enregistrement impossible"),
        tone: "danger",
      });
      return false;
    }
  }

  async function handleDelete(id: string) {
    try {
      const deleted = await api.remove(id);
      if (!deleted) {
        toast?.show({ message: "Fiche introuvable, suppression non effectuée", tone: "danger" });
        return;
      }
      setItems((prev) => (prev ? prev.filter((entry) => entry.id !== id) : prev));
      toast?.show({ message: "Fiche supprimée", tone: "default", duration: 2500 });
    } catch (cause) {
      toast?.show({
        message: describeActionError(cause, "Suppression impossible"),
        tone: "danger",
      });
    }
  }

  return (
    <div className="min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <PageHeader
          eyebrow="Module"
          title="Accréditations"
          description="Demandes extraites de Gmail : artiste, lieu, date et statut. Corrige une extraction approximative, change un statut, supprime une fiche."
          actions={
            <button
              type="button"
              className="ui-btn ui-btn--primary gap-2"
              onClick={handleScan}
              disabled={scanning}
            >
              <RefreshCw className={`h-4 w-4 ${scanning ? "animate-spin" : ""}`} aria-hidden />
              {scanning ? "Scan en cours" : "Scanner Gmail"}
            </button>
          }
        />

        {error && (
          <div role="alert" className="ui-card mb-6 flex items-center justify-between gap-3 p-4">
            <p className="text-[length:var(--t-small)] text-[var(--danger)]">{error}</p>
            <button type="button" className="ui-btn ui-btn--ghost ui-btn--sm" onClick={reload}>
              Réessayer
            </button>
          </div>
        )}

        <div className="mb-6 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {FILTER_ORDER.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className="ui-chip shrink-0"
                data-active={filter === id}
                onClick={() => setFilter(id)}
              >
                {label}
                <span className="ui-mono opacity-60">{counts[id]}</span>
              </button>
            ))}
          </div>
          <div className="ui-field min-w-[200px] max-w-xs flex-1">
            <Search className="h-4 w-4 shrink-0 text-[var(--text-3)]" aria-hidden />
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filtrer par artiste, lieu ou contact…"
              aria-label="Filtrer les accréditations"
              className="min-w-0 flex-1 bg-transparent text-base outline-none"
            />
          </div>
        </div>

        {items === null ? (
          <div className="border-t border-[var(--line)]">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="border-b border-[var(--line)] py-4">
                <Skeleton className="h-10" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          items.length === 0 ? (
            <EmptyState
              icon={<Ticket className="h-8 w-8" aria-hidden />}
              title="Aucune accréditation"
              description="Lance un scan Gmail : les emails contenant « accréditation », « photo pass » ou « press » deviennent des fiches. Tu pourras ensuite corriger l'artiste, le lieu et la date."
            />
          ) : (
            <EmptyState
              title="Aucun résultat"
              description="Aucune fiche ne correspond à ce filtre ou à cette recherche."
            />
          )
        ) : (
          <div className="border-t border-[var(--line)]">
            {filtered.map((entry) => (
              <AccreditationRow
                key={entry.id}
                accreditation={entry}
                onStatus={(status) => handleStatus(entry.id, status)}
                onSave={handleSave}
                onDelete={() => handleDelete(entry.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
