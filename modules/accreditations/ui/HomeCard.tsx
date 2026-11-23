"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpRight, Ticket } from "lucide-react";
import { useModuleAction } from "@backstage/module-kit";

import { countAwaitingFollowUp } from "../followup";import { accreditationsApi } from "./api";

/**
 * Carte d'accueil du module : combien de demandes de relance attendent.
 *
 * Elle ne charge que la liste locale et renvoie vers la page. La garde par
 * `useRef` évite la boucle de chargement décrite dans #251.
 */
export function AccreditationsHomeCard() {
  const call = useModuleAction();
  const api = useMemo(() => accreditationsApi(call), [call]);
  const [count, setCount] = useState<number | null>(null);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    let active = true;
    api
      .load()
      .then((data) => {
        if (active) setCount(countAwaitingFollowUp(data.accreditations, Date.now()));
      })
      .catch((error) => {
        console.error("[accreditations] chargement de la carte d'accueil echoue:", error);
      });
    return () => {
      active = false;
    };
  }, [api]);

  const summary =
    count === null
      ? "Chargement..."
      : count === 0
        ? "Aucune relance en attente"
        : `${count} demande${count > 1 ? "s" : ""} à relancer`;

  return (
    <Link
      href="/m/accreditations"
      className="ui-tile group flex w-full items-center gap-3 p-4 text-left transition-colors duration-150 hover:bg-[var(--surface-2)]"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
        <Ticket className="h-4 w-4" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="ui-mono block text-[var(--text-3)]">Accréditations</span>
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
