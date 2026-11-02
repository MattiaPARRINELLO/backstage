"use client";

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/Chrome";
import { cn } from "@/lib/utils";
import { loadActivity } from "@/app/actions/activity";
import type { ActivityEntry, ActivityAction } from "@/lib/types";

const ACTION_LABELS: Partial<Record<ActivityAction, string>> = {
  ai_action: "Action IA",
  accreditation_created: "Accréditation créée",
  accreditation_updated: "Accréditation mise à jour",
  accreditation_deleted: "Accréditation supprimée",
  concert_updated: "Concerts mis à jour",
  reminder_created: "Rappel créé",
  reminder_updated: "Rappel modifié",
  reminder_deleted: "Rappel supprimé",
  watch_later_added: "Ajouté à voir plus tard",
  watch_later_deleted: "Retiré de à voir plus tard",
  memory_added: "Fait mémorisé",
  memory_updated: "Fait modifié",
  memory_deleted: "Fait supprimé",
  leetcode_solved: "Exercice LeetCode résolu",
};

const ACTION_COLORS: Partial<Record<ActivityAction, string>> = {
  ai_action: "text-[var(--text-2)]",
  accreditation_created: "text-[var(--accent)]",
  accreditation_updated: "text-[var(--text-2)]",
  accreditation_deleted: "text-[var(--danger)]",
  reminder_created: "text-[var(--accent)]",
  reminder_updated: "text-[var(--text-2)]",
  reminder_deleted: "text-[var(--danger)]",
  watch_later_added: "text-[var(--accent)]",
  watch_later_deleted: "text-[var(--danger)]",
  memory_added: "text-[var(--accent)]",
  memory_updated: "text-[var(--text-2)]",
  memory_deleted: "text-[var(--danger)]",
  leetcode_solved: "text-[var(--accent)]",
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "À l'instant";
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days}j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function groupByDate(entries: ActivityEntry[]): Map<string, ActivityEntry[]> {
  const groups = new Map<string, ActivityEntry[]>();
  for (const e of entries) {
    const key = new Date(e.createdAt).toLocaleDateString("fr-FR", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const existing = groups.get(key) ?? [];
    existing.push(e);
    groups.set(key, existing);
  }
  return groups;
}

export function ActivityView({ entries: initial }: { entries: ActivityEntry[] }) {
  const [entries, setEntries] = useState(initial);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    const fresh = await loadActivity(50);
    setEntries(fresh);
    setLoading(false);
  }

  const groups = groupByDate(entries);

  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
          <PageHeader
            title="Journal d'activité"
            description="Toutes les actions récentes dans BACKSTAGE."
            actions={
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-[var(--line-2)] text-[var(--text-2)] transition-colors hover:border-[var(--text-1)] hover:text-[var(--text-1)] disabled:opacity-50"
                aria-label="Rafraîchir"
                title="Rafraîchir"
              >
                <RotateCcw className={cn("h-3.5 w-3.5", loading && "animate-spin")} strokeWidth={1.6} />
              </button>
            }
          />

          {entries.length === 0 ? (
            <div>
              <p className="text-[var(--t-body)] text-[var(--text-1)]">Aucune activité</p>
              <p className="mt-1 text-[var(--t-small)] text-[var(--text-3)]">
                Les actions que tu effectues apparaîtront ici.
              </p>
            </div>
          ) : (
            <div className="space-y-10">
              {Array.from(groups.entries()).map(([date, dayEntries]) => (
                <section key={date}>
                  <h2 className="ui-mono text-[var(--text-3)] first-letter:uppercase">{date}</h2>
                  <div className="mt-3 border-t border-[var(--line)]">
                    {dayEntries.map((e) => (
                      <div
                        key={e.id}
                        className="flex items-start gap-4 border-b border-[var(--line)] py-3 last:border-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-[length:var(--t-body)] leading-snug text-[var(--text-2)]">
                            <span className={cn("font-medium", ACTION_COLORS[e.action] ?? "text-[var(--text-1)]")}>
                              {ACTION_LABELS[e.action] ?? e.action}
                            </span>
                            {" — "}
                            <span className="text-[var(--text-1)]">{e.label}</span>
                          </p>
                          {e.details && (
                            <p className="ui-mono mt-1 truncate text-[var(--text-3)]">{e.details}</p>
                          )}
                        </div>
                        <time className="ui-mono shrink-0 pt-0.5 text-[var(--text-3)]">
                          {formatTime(e.createdAt)}
                        </time>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
