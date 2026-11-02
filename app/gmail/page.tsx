"use client";

import { ExternalLink, Loader2 } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader, EmptyState } from "@/components/layout/Chrome";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, type GmailMessage } from "@/lib/api-client";
import { useCachedFetch } from "@/lib/cache";
import { formatDateShort } from "@/lib/date";
import { cn } from "@/lib/utils";

function extractName(from: string): string {
  const match = from.match(/^"?(.+?)"?\s*</);
  return match ? match[1].trim() : from.replace(/<.+>/, "").trim() || from;
}

const GMAIL_CACHE_KEY = "gmail:page:list";

async function fetchAllGmail(): Promise<GmailMessage[]> {
  const res = await api.gmail.list();
  if (res.error) throw new Error(res.error);
  return res.messages ?? [];
}

export default function GmailPage() {
  const { data: messages, loading, error } = useCachedFetch<GmailMessage[]>(
    GMAIL_CACHE_KEY,
    fetchAllGmail,
    { ttl: 2 * 60 * 1000 }
  );

  const visible = messages ?? [];
  const unread = visible.filter((m) => m.unread).length;

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
        <PageHeader
          title="Gmail"
          actions={
            <a
              href="https://mail.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="ui-btn ui-btn--text"
            >
              Ouvrir Gmail
              <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.5} />
            </a>
          }
        />

        <div className="mt-6">
          {error && visible.length === 0 && (
            <div className="mb-6 rounded-[var(--r-sm)] border-l-2 border-[var(--danger)] bg-[var(--danger)]/8 px-3 py-2 text-[length:var(--t-small)] text-[var(--danger)]">
              {error.message}
            </div>
          )}

          {visible.length > 0 && (
            <div className="mb-2 flex items-center justify-between gap-3">
              <span className="ui-mono text-[var(--text-3)]">
                {unread} non lu{unread > 1 ? "s" : ""} · {visible.length} message
                {visible.length > 1 ? "s" : ""}
              </span>
              {loading && (
                <span className="ui-mono inline-flex items-center gap-1.5 text-[var(--text-3)]">
                  <Loader2 className="w-3 h-3 animate-spin text-[var(--accent)]" />
                  Actualisation…
                </span>
              )}
            </div>
          )}

          {loading && visible.length === 0 && (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          )}

          {!loading && visible.length === 0 && (
            <EmptyState
              title="Aucun email"
              description="Ta boîte de réception est vide."
            />
          )}

          {visible.length > 0 && (
            <ul className="border-t border-[var(--line)]">
              {visible.map((msg) => (
                <li
                  key={msg.id}
                  className="border-b border-[var(--line)] py-4"
                >
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className={cn(
                        "mt-2 h-1.5 w-1.5 shrink-0 rounded-full",
                        msg.unread ? "bg-[var(--accent)]" : "bg-transparent"
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-3">
                        <p
                          className={cn(
                            "truncate text-[15px] font-medium",
                            msg.unread ? "text-[var(--text-1)]" : "text-[var(--text-2)]"
                          )}
                        >
                          {extractName(msg.from)}
                        </p>
                        <span className="ui-mono shrink-0 text-[var(--text-3)]">
                          {formatDateShort(msg.date)}
                        </span>
                      </div>
                      <p
                        className={cn(
                          "mt-0.5 truncate text-[length:var(--t-small)]",
                          msg.unread ? "text-[var(--text-1)]" : "text-[var(--text-2)]"
                        )}
                      >
                        {msg.subject || "(Sans objet)"}
                      </p>
                      <p className="mt-1 line-clamp-2 text-[length:var(--t-small)] leading-relaxed text-[var(--text-2)]">
                        {msg.snippet}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}
