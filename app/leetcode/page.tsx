"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Skeleton } from "@/components/ui/Skeleton";
import { loadLeetcode, syncLeetcode, getSmartSuggestion } from "@/app/actions/leetcode";
import { LEETCODE_CACHE_KEY } from "@/components/widgets/LeetCodeWidget";
import { invalidateCache } from "@/lib/cache";
import { UNRANKED_RANKING } from "@/lib/leetcode-api";
import { activityLevel, buildActivityGrid } from "@/lib/leetcode-utils";
import type { LeetcodeData } from "@/lib/types";
import { Loader2, CheckCircle2, RefreshCw, CalendarRange } from "lucide-react";

const WEEKS = 17;

// Carrés d'activité : un seul accent, l'intensité porte le volume.
const LEVEL_OPACITY = [0, 0.18, 0.38, 0.62, 1];

export default function LeetcodePage() {
  const [data, setData] = useState<LeetcodeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [smartSuggestion, setSmartSuggestion] = useState<string>("");
  const [smartLoading, setSmartLoading] = useState(false);

  useEffect(() => {
    loadLeetcode()
      .then(setData)
      .catch(() => setError("Impossible de charger les données"))
      .finally(() => setLoading(false));
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setError("");
    try {
      const updated = await syncLeetcode();
      // Le cache partagé du widget doit voir la nouvelle valeur, sinon la carte
      // du panneau de droite garderait l'ancienne pendant 30 min.
      invalidateCache(LEETCODE_CACHE_KEY);
      setData(updated);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur de synchronisation");
    } finally {
      setSyncing(false);
    }
  };

  const handleSmartSchedule = async () => {
    setSmartLoading(true);
    try {
      const suggestion = await getSmartSuggestion();
      setSmartSuggestion(suggestion);
    } catch {
      setSmartSuggestion("Impossible d'analyser ton calendrier.");
    } finally {
      setSmartLoading(false);
    }
  };

  const grid = useMemo(
    () => buildActivityGrid(data?.submissions?.calendar ?? {}, WEEKS),
    [data]
  );
  const windowSubmissions = useMemo(
    () => grid.flat().reduce((sum, day) => sum + day.count, 0),
    [grid]
  );

  if (loading) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl space-y-4 px-4 py-10 sm:px-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-40 w-full" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[1, 2].map((i) => <Skeleton key={i} className="h-48" />)}
          </div>
        </div>
      </AppShell>
    );
  }

  if (!data) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
          <EmptyState
            title="LeetCode"
            description={error || "Connecte ton compte LeetCode pour commencer."}
          />
        </div>
      </AppShell>
    );
  }

  if (!data.leetcodeUsername) {
    return (
      <AppShell>
        <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
          <PageHeader
            title="LeetCode"
            description="Suis ta progression et trouve le bon exercice au bon moment."
          />
          <div className="ui-card p-6">
            <p className="max-w-[34rem] text-[length:var(--t-body)] leading-relaxed text-[var(--text-2)]">
              Aucun pseudo LeetCode n&apos;est enregistré, donc rien ne peut être
              synchronisé. Renseigne-le dans les{" "}
              <Link href="/settings" className="text-[var(--accent)] hover:underline">
                réglages
              </Link>{" "}
              : le pseudo est vérifié auprès de l&apos;API avant d&apos;être enregistré.
            </p>
          </div>
        </div>
      </AppShell>
    );
  }

  const ranking = data.ranking ?? 0;
  const ranked = ranking > 0 && ranking < UNRANKED_RANKING;
  const contest = data.contest;
  const exercises = data.exercises ?? [];

  const stats = [
    { key: "solved", label: "Résolus", value: String(data.totalSolved ?? 0) },
    { key: "subs", label: "Soumissions acceptées", value: String(data.totalSubmissions ?? 0) },
    { key: "rank", label: "Rang", value: ranked ? `#${ranking.toLocaleString("fr-FR")}` : "non classé" },
  ];

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-10 sm:px-6">
        <PageHeader
          title="LeetCode"
          description={`Compte ${data.leetcodeUsername} — suivi réel de ta progression.`}
          actions={
            <button
              onClick={handleSync}
              disabled={syncing}
              className="ui-btn ui-btn--ghost"
            >
              {syncing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" strokeWidth={1.5} />
              )}
              {syncing ? "Synchro…" : "Synchroniser"}
            </button>
          }
        />

        {(error || data.syncError) && (
          <div className="rounded-[var(--r-sm)] border-l-2 border-[var(--danger)] bg-[var(--danger)]/8 px-3 py-2 text-[length:var(--t-small)] text-[var(--danger)]">
            {error || data.syncError}
          </div>
        )}

        <div className="ui-card flex flex-col gap-8 p-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="shrink-0">
            <p className="ui-label">Série en cours</p>
            <p className="font-display text-[length:var(--t-display)] font-semibold leading-[0.88] tracking-[-0.045em] tabular-nums text-[var(--text-1)]">
              {data.streak}
            </p>
            <p className="ui-label mt-2">
              jour{(data.streak ?? 0) > 1 ? "s" : ""} d&apos;affilée
            </p>
          </div>
          <dl className="grid flex-1 grid-cols-3 gap-4 sm:border-l sm:border-[var(--line)] sm:pl-8">
            {stats.map((stat) => (
              <div key={stat.key} className="min-w-0">
                <dt className="ui-label">{stat.label}</dt>
                <dd className="mt-1 truncate font-display text-[length:var(--t-lead)] font-semibold leading-tight tracking-[-0.02em] tabular-nums text-[var(--text-1)]">
                  {stat.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="ui-card p-6 lg:col-span-2">
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
              <h3 className="text-[length:var(--t-body)] font-medium text-[var(--text-1)]">
                Activité — {WEEKS} dernières semaines
              </h3>
              <span className="ui-mono text-[var(--text-3)]">
                {windowSubmissions} soumission{windowSubmissions > 1 ? "s" : ""} déposée
                {windowSubmissions > 1 ? "s" : ""}
              </span>
            </div>

            <div className="overflow-x-auto">
              <div className="flex w-max gap-[3px]">
                {grid.map((week, wi) => (
                  <div key={wi} className="flex flex-col gap-[3px]">
                    {week.map((day) => {
                      const level = activityLevel(day.count);
                      return (
                        <div
                          key={day.key}
                          title={`${day.key} — ${day.count} soumission${day.count > 1 ? "s" : ""}`}
                          className="h-3.5 w-3.5 rounded-[3px]"
                          style={
                            level === 0
                              ? { backgroundColor: "var(--surface-3)" }
                              : { backgroundColor: "var(--accent)", opacity: LEVEL_OPACITY[level] }
                          }
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>

            <p className="ui-mono mt-4 text-[var(--text-3)]">
              {data.submissions?.totalActiveDays ?? 0} jour
              {(data.submissions?.totalActiveDays ?? 0) > 1 ? "s" : ""} d&apos;activité au total
              {data.syncedAt && (
                <> · dernière synchro {new Date(data.syncedAt).toLocaleString("fr-FR")}</>
              )}
            </p>
          </div>

          <div className="ui-card p-6">
            <h3 className="mb-4 text-[length:var(--t-body)] font-medium text-[var(--text-1)]">
              Contest
            </h3>
            {contest ? (
              <div className="space-y-4">
                <div className="flex items-baseline gap-3">
                  <span className="font-display text-[length:var(--t-head)] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[var(--text-1)]">
                    {contest.rating}
                  </span>
                  {contest.badge && (
                    <span className="ui-mono text-[var(--text-3)]">{contest.badge}</span>
                  )}
                </div>
                <dl className="space-y-2 border-t border-[var(--line)] pt-3">
                  <div className="flex items-center justify-between gap-3">
                    <dt className="ui-label">Participations</dt>
                    <dd className="ui-mono tabular-nums text-[var(--text-1)]">{contest.attended}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <dt className="ui-label">Top</dt>
                    <dd className="ui-mono tabular-nums text-[var(--text-1)]">{contest.topPercentage}%</dd>
                  </div>
                  {contest.globalRanking > 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <dt className="ui-label">Rang global</dt>
                      <dd className="ui-mono tabular-nums text-[var(--text-1)]">
                        #{contest.globalRanking.toLocaleString("fr-FR")}
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            ) : (
              <p className="max-w-[34rem] text-[length:var(--t-small)] leading-relaxed text-[var(--text-2)]">
                Aucun contest enregistré sur ce compte — le rating apparaîtra après
                ta première participation.
              </p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="ui-card p-6">
            <h3 className="mb-4 text-[length:var(--t-body)] font-medium text-[var(--text-1)]">
              Répartition par difficulté
            </h3>
            <div className="space-y-4">
              <DifficultyBar
                label="Easy"
                solved={data.easySolved ?? 0}
                total={data.totalSolved ?? 0}
                tone="var(--success)"
              />
              <DifficultyBar
                label="Medium"
                solved={data.mediumSolved ?? 0}
                total={data.totalSolved ?? 0}
                tone="var(--accent)"
              />
              <DifficultyBar
                label="Hard"
                solved={data.hardSolved ?? 0}
                total={data.totalSolved ?? 0}
                tone="var(--danger)"
              />
            </div>
          </div>

          <div className="ui-card p-6">
            <h3 className="mb-4 text-[length:var(--t-body)] font-medium text-[var(--text-1)]">
              Créneau du jour
            </h3>
            <p className="mb-4 max-w-[34rem] text-[length:var(--t-small)] leading-relaxed text-[var(--text-2)]">
              Croise ton agenda du jour avec ta progression pour proposer une
              difficulté adaptée au temps libre réel.
            </p>
            <button
              onClick={handleSmartSchedule}
              disabled={smartLoading}
              className="ui-btn ui-btn--ghost w-full"
            >
              {smartLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CalendarRange className="w-4 h-4" strokeWidth={1.5} />
              )}
              {smartLoading ? "Analyse…" : "Analyser mon agenda"}
            </button>
            {smartSuggestion && (
              <div className="mt-4 whitespace-pre-wrap border-t border-[var(--line)] pt-4 text-[length:var(--t-small)] leading-relaxed text-[var(--text-2)]">
                {smartSuggestion}
              </div>
            )}
          </div>
        </div>

        {exercises.length > 0 && (
          <div className="ui-card p-6">
            <h3 className="mb-2 text-[length:var(--t-body)] font-medium text-[var(--text-1)]">
              Exercices enregistrés
            </h3>
            <ul className="divide-y divide-[var(--line)]">
              {exercises.slice(0, 10).map((ex) => (
                <li key={ex.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-[var(--success)]" strokeWidth={1.5} />
                    <div className="min-w-0">
                      <div className="truncate text-[length:var(--t-body)] text-[var(--text-1)]">{ex.title}</div>
                      <div className="ui-mono text-[var(--text-3)]">
                        {new Date(ex.createdAt).toLocaleDateString("fr-FR")}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {ex.difficulty && (
                      <span className="ui-mono text-[var(--text-3)]">{ex.difficulty}</span>
                    )}
                    {ex.duration && (
                      <span className="ui-mono tabular-nums text-[var(--text-3)]">{ex.duration} min</span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function DifficultyBar({
  label,
  solved,
  total,
  tone,
}: {
  label: string;
  solved: number;
  total: number;
  tone: string;
}) {
  const share = total > 0 ? (solved / total) * 100 : 0;
  return (
    <div>
      <div className="mb-1.5 flex items-baseline justify-between gap-3">
        <span className="ui-label">{label}</span>
        <span className="ui-mono tabular-nums text-[var(--text-1)]">
          {solved}
          <span className="text-[var(--text-3)]"> · {Math.round(share)}%</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
        <div
          className="h-full rounded-full transition-[width] duration-500"
          style={{ width: `${share}%`, background: tone }}
        />
      </div>
    </div>
  );
}
