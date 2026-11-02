"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";
import type { DailyBrief } from "@/lib/types";
import { Markdown } from "@/components/ui/Markdown";
import { formatRelative } from "@/lib/date";

export default function DailyBriefPage() {
  const [brief, setBrief] = useState<DailyBrief | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/daily-brief")
      .then((res) => {
        if (!res.ok) throw new Error("Introuvable");
        return res.json();
      })
      .then((data) => setBrief(data.brief))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--text-3)]" strokeWidth={1.6} />
      </div>
    );
  }

  if (error || !brief) {
    return (
      <div className="py-20">
        <p className="text-[var(--t-body)] text-[var(--text-1)]">Aucun brief disponible.</p>
        <p className="mt-1 text-[var(--t-small)] text-[var(--text-3)]">
          Il sera généré au prochain déclenchement du matin.
        </p>
        <Link href="/chat" className="ui-btn ui-btn--text mt-5 text-[var(--t-small)]">
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.6} aria-hidden />
          Retour
        </Link>
      </div>
    );
  }

  return (
    <>
      <Link
        href="/chat"
        className="ui-btn ui-btn--text mb-10 text-[var(--t-small)]"
      >
        <ArrowLeft className="w-3.5 h-3.5" strokeWidth={1.6} aria-hidden />
        BACKSTAGE
      </Link>

      <header className="mb-8">
        <h1 className="font-display text-[30px] font-semibold leading-[1.05] tracking-[-0.03em] text-[var(--text-1)]">
          Brief du jour
        </h1>
        <p className="ui-mono mt-2 text-[var(--text-3)]">
          {formatRelative(brief.date)}
        </p>
      </header>

      <div className="ui-card mb-10 p-6">
        <Markdown className="text-[var(--t-body)]">{brief.summary}</Markdown>
      </div>

      {brief.weather && (
        <Section label="Météo">
          <p className="py-3 text-[var(--t-body)] text-[var(--text-2)]">{brief.weather}</p>
        </Section>
      )}

      {brief.leetcodeDaily && (
        <Section label="LeetCode du jour">
          <p className="flex flex-wrap items-baseline gap-3 py-3 text-[var(--t-body)] text-[var(--text-1)]">
            {brief.leetcodeDaily.title}
            <span className="ui-chip">{brief.leetcodeDaily.difficulty}</span>
          </p>
        </Section>
      )}

      {brief.reminders.length > 0 && (
        <Section label="Rappels">
          <ul>
            {brief.reminders.map((r, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-3 border-b border-[var(--line)] py-3 last:border-0">
                <span className="text-[var(--t-body)] text-[var(--text-1)]">{r.title}</span>
                <span className="ui-mono text-[var(--text-3)]">{formatRelative(r.dueAt)}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {brief.events.length > 0 && (
        <Section label="Événements">
          <ul>
            {brief.events.map((e, i) => (
              <li key={i} className="border-b border-[var(--line)] py-3 text-[var(--t-body)] text-[var(--text-1)] last:border-0">
                {e.title}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {brief.urgentEmails && brief.urgentEmails.length > 0 && (
        <Section label="Emails urgents">
          <ul>
            {brief.urgentEmails.map((e, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-3 border-b border-[var(--line)] py-3 last:border-0">
                <span className="text-[var(--t-body)] text-[var(--text-1)]">{e.subject}</span>
                <span className="ui-mono text-[var(--text-3)]">{e.from}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {brief.concertChecklist && brief.concertChecklist.length > 0 && (
        <Section label="Checklist concert">
          <ul>
            {brief.concertChecklist.map((item, i) => (
              <li key={i} className="border-b border-[var(--line)] py-3 text-[var(--t-body)] text-[var(--text-2)] last:border-0">
                {item}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <div className="mt-12 border-t border-[var(--line)] pt-5">
        <p className="ui-mono text-[var(--text-3)]">
          Généré à {new Date(brief.generatedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
    </>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-[17px] font-semibold tracking-[-0.02em] text-[var(--text-1)]">
        {label}
      </h2>
      <div className="mt-3 border-t border-[var(--line)]">{children}</div>
    </section>
  );
}
