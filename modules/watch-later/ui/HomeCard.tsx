"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowUpRight, Bookmark } from "lucide-react";
import { useModuleAction } from "@backstage/module-kit";

import type { WatchLaterItem } from "../schema";
import { watchLaterApi } from "./api";

/**
 * Carte d'accueil du module : nombre de liens gardes et dernier ajout.
 *
 * Elle ne charge que la liste locale (aucun appel reseau vers le lien) et
 * renvoie vers la page du module.
 */
export function WatchLaterHomeCard() {
  const call = useModuleAction();
  const api = useMemo(() => watchLaterApi(call), [call]);
  const [items, setItems] = useState<WatchLaterItem[] | null>(null);

  useEffect(() => {
    let active = true;
    api
      .load()
      .then((data) => {
        if (active) setItems(data.items);
      })
      .catch((error) => {
        console.error("[watch-later] chargement de la carte d'accueil echoue:", error);
      });
    return () => {
      active = false;
    };
  }, [api]);

  const summary =
    items === null
      ? "Chargement..."
      : items.length === 0
        ? "Aucun lien garde"
        : `${items.length} lien${items.length > 1 ? "s" : ""}${items[0] ? ` · ${items[0].title}` : ""}`;

  return (
    <Link
      href="/m/watch-later"
      className="ui-tile group flex w-full items-center gap-3 p-4 text-left transition-colors duration-150 hover:bg-[var(--surface-2)]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
        <Bookmark className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="ui-mono block text-[var(--text-3)]">À voir plus tard</span>
        <span className="mt-0.5 block truncate text-[length:var(--t-small)] text-[var(--text-2)]">
          {summary}
        </span>
      </span>
      <ArrowUpRight
        className="h-4 w-4 shrink-0 text-[var(--text-4)] transition-colors group-hover:text-[var(--accent)]"
        aria-hidden
      />
    </Link>
  );
}
