"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useModuleAction } from "@backstage/module-kit";

import type { WatchLaterItem } from "../schema";
import { watchLaterApi } from "./api";

/**
 * Panneau du module : les derniers liens gardes, avec un acces a la page.
 *
 * La page complete reste la destination ; le panneau donne un apercu depuis
 * n'importe quel ecran, comme les widgets du noyau.
 */
export function WatchLaterPanel() {
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
        console.error("[watch-later] chargement du panneau echoue:", error);
      });
    return () => {
      active = false;
    };
  }, [api]);

  const recent = items?.slice(0, 5) ?? [];

  return (
    <div className="ui-tile p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="ui-mono text-[var(--text-3)]">Derniers liens</span>
        <Link href="/m/watch-later" className="ui-mono text-[var(--accent)] hover:underline">
          Tout voir
        </Link>
      </div>

      {items === null ? (
        <p className="py-2 text-[length:var(--t-small)] text-[var(--text-3)]">Chargement...</p>
      ) : recent.length === 0 ? (
        <p className="py-2 text-[length:var(--t-small)] text-[var(--text-3)]">
          Aucun lien garde pour le moment.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--line)]">
          {recent.map((item) => (
            <li key={item.id} className="py-2">
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block truncate text-[length:var(--t-small)] text-[var(--text-1)] hover:text-[var(--accent)]"
              >
                {item.title}
              </a>
              <span className="ui-mono text-[var(--text-4)]">{item.source}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
