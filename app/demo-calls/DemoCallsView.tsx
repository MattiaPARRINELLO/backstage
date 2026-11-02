"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, RefreshCw, Search } from "lucide-react";
import { loadDemoCalls } from "@/app/actions/demo-calls";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/Chrome";
import { cn } from "@/lib/utils";
import type { DemoCallEntry, DemoCallOutcome } from "@/lib/types";

const OUTCOME_LABELS: Record<DemoCallOutcome, string> = {
  success: "Succès",
  rate_limited: "Quota atteint",
  invalid_json: "JSON invalide",
  invalid_input: "Entrée invalide",
  configuration_error: "Configuration IA",
  empty_response: "Réponse vide",
  provider_error: "Erreur fournisseur",
  timeout: "Délai dépassé",
};

function formatDate(value: string): string {
  return new Date(value).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function matches(call: DemoCallEntry, query: string): boolean {
  if (!query) return true;
  const needle = query.toLocaleLowerCase("fr-FR");
  return [call.input, call.response, call.error, call.ip, call.userAgent, call.requestId]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLocaleLowerCase("fr-FR").includes(needle));
}

function outcomeColor(outcome: DemoCallOutcome): string {
  if (outcome === "success") return "var(--success)";
  if (outcome === "rate_limited") return "var(--text-2)";
  return "var(--danger)";
}

export function DemoCallsView({ initialCalls }: { initialCalls: DemoCallEntry[] }) {
  const [calls, setCalls] = useState(initialCalls);
  const [query, setQuery] = useState("");
  const [outcome, setOutcome] = useState<"all" | DemoCallOutcome>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(
    () => calls.filter((call) => (outcome === "all" || call.outcome === outcome) && matches(call, query)),
    [calls, outcome, query]
  );

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      setCalls(await loadDemoCalls(1000));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Impossible de charger les appels");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
          <PageHeader
            title="Appels de la démo"
            description="Journal des requêtes IA publiques : contenu envoyé, réponse et métadonnées d’abus potentielles."
            actions={
              <button
                type="button"
                onClick={refresh}
                disabled={loading}
                className="ui-btn ui-btn--ghost h-9 px-4 text-[var(--t-small)]"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} strokeWidth={1.6} />
                Actualiser
              </button>
            }
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="ui-field h-10 min-w-0 flex-1 gap-2.5">
              <Search className="h-3.5 w-3.5 shrink-0 text-[var(--text-3)]" strokeWidth={1.6} aria-hidden />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Rechercher dans les appels…"
                aria-label="Rechercher dans les appels"
                className="w-full min-w-0 bg-transparent text-[var(--t-small)] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)]"
              />
            </div>
            <select
              value={outcome}
              onChange={(event) => setOutcome(event.target.value as "all" | DemoCallOutcome)}
              aria-label="Filtrer par résultat"
              className="ui-field h-10 w-full cursor-pointer text-[var(--t-small)] text-[var(--text-1)] sm:w-52"
            >
              <option value="all">Tous les résultats</option>
              {Object.entries(OUTCOME_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
            <span className="ui-mono shrink-0 text-[var(--text-3)]">
              {filtered.length} / {calls.length}
            </span>
          </div>

          {error && (
            <p className="mt-4 text-[var(--t-small)] text-[var(--danger)]" role="alert">
              {error}
            </p>
          )}

          <div className="mt-8">
            {filtered.length === 0 ? (
              <div>
                <p className="text-[var(--t-body)] text-[var(--text-1)]">
                  {calls.length === 0 ? "Aucun appel enregistré" : "Aucun résultat"}
                </p>
                <p className="mt-1 text-[var(--t-small)] text-[var(--text-3)]">
                  {calls.length === 0
                    ? "Les prochains appels à /api/demo apparaîtront ici."
                    : "Modifie votre recherche ou votre filtre."}
                </p>
              </div>
            ) : (
              <div className="border-t border-[var(--line)]">
                {filtered.map((call) => {
                  const isOpen = expanded === call.id;
                  return (
                    <article key={call.id} className="border-b border-[var(--line)]">
                      <button
                        type="button"
                        onClick={() => setExpanded(isOpen ? null : call.id)}
                        className="flex w-full items-start gap-4 py-4 text-left transition-colors hover:bg-[var(--surface-2)]"
                        aria-expanded={isOpen}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                            <span
                              className="text-[15px] font-medium"
                              style={{ color: outcomeColor(call.outcome) }}
                            >
                              {OUTCOME_LABELS[call.outcome]}
                            </span>
                            <span className="ui-mono text-[var(--text-3)]">
                              {call.status} · {call.durationMs} ms
                            </span>
                            <span className="ui-mono text-[var(--text-3)]">{formatDate(call.createdAt)}</span>
                          </span>
                          <span className="mt-1.5 block truncate text-[15px] text-[var(--text-1)]">
                            {call.input ?? "Aucun contenu reçu"}
                          </span>
                          <span className="ui-mono mt-1 block truncate text-[var(--text-3)]">
                            {call.ip} · {call.userAgent}
                          </span>
                        </span>
                        {isOpen ? (
                          <ChevronUp className="mt-1 h-4 w-4 shrink-0 text-[var(--text-3)]" strokeWidth={1.6} />
                        ) : (
                          <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-[var(--text-3)]" strokeWidth={1.6} />
                        )}
                      </button>

                      {isOpen && (
                        <div className="space-y-6 pb-6">
                          <dl className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
                            <Meta label="Requête" value={call.requestId} mono />
                            <Meta label="IP" value={call.ip} mono />
                            <Meta label="Modèle" value={call.model} mono />
                            <Meta label="Durée" value={`${call.durationMs} ms`} mono />
                            <Meta label="X-Forwarded-For" value={call.forwardedFor || "—"} mono />
                            <Meta label="X-Real-IP" value={call.realIp || "—"} mono />
                            <Meta label="User-Agent" value={call.userAgent} />
                            <Meta label="Referer" value={call.referer} />
                          </dl>

                          <div>
                            <p className="ui-mono text-[var(--text-3)]">Question reçue</p>
                            <pre className="mt-2 whitespace-pre-wrap rounded-[var(--r-sm)] bg-[var(--surface-2)] p-4 text-[var(--t-small)] leading-relaxed text-[var(--text-1)]">
                              {call.input ?? "—"}
                            </pre>
                          </div>

                          {call.response && (
                            <div>
                              <p className="ui-mono text-[var(--text-3)]">Réponse IA</p>
                              <pre className="mt-2 whitespace-pre-wrap rounded-[var(--r-sm)] bg-[var(--surface-2)] p-4 text-[var(--t-small)] leading-relaxed text-[var(--text-1)]">
                                {call.response}
                              </pre>
                            </div>
                          )}

                          {call.error && (
                            <div>
                              <p className="ui-mono text-[var(--text-3)]">Erreur</p>
                              <p className="mt-2 text-[var(--t-small)] leading-relaxed text-[var(--danger)]" role="alert">
                                {call.error}
                              </p>
                            </div>
                          )}

                          {call.sources.length > 0 && (
                            <div>
                              <p className="ui-mono text-[var(--text-3)]">Sources sélectionnées</p>
                              <div className="mt-2 flex flex-wrap gap-2">
                                {call.sources.map((source) => (
                                  <span key={`${source.kind}-${source.title}`} className="ui-chip">
                                    {source.kind} · {source.title}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Meta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <dt className="ui-mono text-[var(--text-3)]">{label}</dt>
      <dd
        className={cn("mt-1 truncate text-[var(--t-small)] text-[var(--text-1)]", mono && "font-mono")}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}
