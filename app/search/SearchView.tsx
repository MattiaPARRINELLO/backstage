"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ArrowUpRight } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { unifiedSearch, type UnifiedSearchResult } from "@/app/actions/search";
import type { ConcertEvent, MemoryFact, Email, Reminder, WatchLaterItem, Accreditation } from "@/lib/types";

const LABELS: Record<keyof UnifiedSearchResult, string> = {
  concerts: "Concerts",
  facts: "Mémoire",
  emails: "Emails",
  reminders: "Rappels",
  watchLater: "À voir",
  accreditations: "Accréditations",
};

function countResults(r: UnifiedSearchResult): number {
  return Object.values(r).reduce((a, b) => a + b.length, 0);
}

export function SearchView() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UnifiedSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleChange(value: string) {
    setQuery(value);
    clearTimeout(timerRef.current);
    if (!value.trim()) {
      setResults(null);
      return;
    }
    timerRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const r = await unifiedSearch(value.trim());
        setResults(r);
      } catch {
        setResults(null);
      }
      setLoading(false);
    }, 250);
  }

  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
          <h1 className="font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--text-1)] sm:text-[34px]">
            Recherche
          </h1>
          <p className="mt-2.5 max-w-xl text-[var(--t-body)] leading-relaxed text-[var(--text-2)]">
            Une requête, toutes les données de BACKSTAGE.
          </p>

          <div className="ui-field mt-7 h-12 w-full gap-2.5">
            <Search
              className="h-4 w-4 shrink-0 text-[var(--text-3)]"
              strokeWidth={1.6}
              aria-hidden
            />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="Concerts, emails, rappels, mémoire, accréditations…"
              aria-label="Rechercher dans BACKSTAGE"
              className="w-full min-w-0 bg-transparent text-[var(--t-body)] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)]"
            />
            {loading && (
              <span
                className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border border-[var(--accent)] border-r-transparent"
                aria-label="Recherche en cours"
              />
            )}
          </div>

          <div className="mt-10">
            {!results && !loading && (
              <p className="text-[var(--t-body)] text-[var(--text-3)]">
                Tape une requête pour chercher dans toutes les données de BACKSTAGE.
              </p>
            )}

            {results && countResults(results) === 0 && !loading && (
              <div>
                <p className="text-[var(--t-body)] text-[var(--text-1)]">Aucun résultat</p>
                <p className="mt-1 text-[var(--t-small)] text-[var(--text-3)]">
                  Rien trouvé pour « {query} ». Essaie d&apos;autres mots-clés.
                </p>
              </div>
            )}

            {results && countResults(results) > 0 && (
              <div className="space-y-10">
                {(Object.keys(LABELS) as (keyof UnifiedSearchResult)[]).map((key) => {
                  const items = results[key];
                  if (items.length === 0) return null;
                  return (
                    <section key={key}>
                      <h2 className="flex items-baseline gap-2 font-display text-[17px] font-semibold tracking-[-0.02em] text-[var(--text-1)]">
                        {LABELS[key]}
                        <span className="ui-mono text-[var(--text-3)]">{items.length}</span>
                      </h2>
                      <div className="mt-3 border-t border-[var(--line)]">
                        {items.map((item) => (
                          <ResultRow key={item.id} item={item} type={key} />
                        ))}
                      </div>
                    </section>
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

type SearchItem = ConcertEvent | MemoryFact | Email | Reminder | WatchLaterItem | Accreditation;

function ResultRow({ item, type }: { item: SearchItem; type: string }) {
  const title = "artist" in item ? item.artist : "title" in item ? item.title : "content" in item ? item.content : "from" in item ? item.from : "";
  const sub = type === "concerts"
    ? `${(item as ConcertEvent).venue} · ${(item as ConcertEvent).date}`
    : type === "emails"
    ? `${(item as Email).subject}`
    : type === "reminders"
    ? `Échéance : ${new Date((item as Reminder).dueAt).toLocaleDateString("fr-FR")}`
    : type === "watchLater"
    ? ((item as WatchLaterItem).description || "")
    : type === "accreditations"
    ? `${(item as Accreditation).venue} · ${(item as Accreditation).status}`
    : "";

  return (
    <a
      href={getHref(item, type)}
      className="group flex items-center gap-4 border-b border-[var(--line)] py-3 transition-colors last:border-0 hover:bg-[var(--surface-2)]"
    >
      <span className="min-w-0 flex-1 truncate text-[15px] text-[var(--text-1)]">
        {String(title)}
      </span>
      {sub && (
        <span className="ui-mono hidden max-w-[220px] shrink-0 truncate text-[var(--text-3)] sm:block">
          {sub}
        </span>
      )}
      <ArrowUpRight
        className="h-3.5 w-3.5 shrink-0 text-[var(--text-4)] transition-colors group-hover:text-[var(--text-1)]"
        strokeWidth={1.6}
        aria-hidden
      />
    </a>
  );
}

function getHref(item: SearchItem, type: string): string {
  switch (type) {
    case "concerts": return "/";
    case "facts": return "/brain";
    case "emails": return "/";
    case "reminders": return "/reminders";
    case "watchLater": return "/watch-later";
    case "accreditations": return "/photos";
    default: return "/";
  }
}
