"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { ExternalLink, RefreshCw } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/Chrome";
import { Skeleton } from "@/components/ui/Skeleton";
import { api, type CalendarEvent, type ScheduleCourse } from "@/lib/api-client";
import { useCachedFetch } from "@/lib/cache";
import { formatTime } from "@/lib/date";
import type { Intention, Reminder } from "@/lib/types";

function dayBounds(): { start: string; end: string } {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function isLate(iso: string): boolean {
  return new Date(iso).getTime() < Date.now();
}

/** Une section se nomme par son titre : aucun surtitre, aucune icone. */
function SectionTitle({
  children,
  href,
}: {
  children: React.ReactNode;
  href: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <h2 className="font-display text-[length:var(--t-lead)] font-semibold tracking-[-0.02em] text-[var(--text-1)]">
        {children}
      </h2>
      <Link
        href={href}
        className="ui-mono text-[var(--text-3)] transition-colors duration-150 hover:text-[var(--text-1)]"
      >
        Tout voir
      </Link>
    </div>
  );
}

function Row({
  time,
  title,
  meta,
  late,
  href,
}: {
  time?: string;
  title: string;
  meta?: string;
  late?: boolean;
  href?: string;
}) {
  const inner = (
    <div className="-mx-3 flex min-w-0 items-baseline gap-4 rounded-[var(--r-sm)] px-3 py-3">
      {time && (
        <span className="ui-mono w-12 shrink-0 text-[var(--text-2)]">{time}</span>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline justify-between gap-3">
          <span className="min-w-0 truncate text-[0.9375rem] text-[var(--text-1)]">
            {title}
          </span>
          {late && (
            <span className="ui-mono shrink-0 text-[var(--danger)]">En retard</span>
          )}
        </div>
        {meta && (
          <p className="mt-0.5 truncate text-[length:var(--t-small)] text-[var(--text-2)]">
            {meta}
          </p>
        )}
      </div>
    </div>
  );
  return href ? (
    <Link
      href={href}
      className="block transition-colors duration-150 hover:bg-[var(--surface-2)]"
    >
      {inner}
    </Link>
  ) : (
    inner
  );
}

/** Liste de donnees : filets de 1px, aucune boite. */
function RowList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-4 border-t border-[var(--line)]">
      {children}
    </ul>
  );
}

export default function TodayPage() {
  const { start, end } = dayBounds();

  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [remindersError, setRemindersError] = useState<string | null>(null);
  const [intentions, setIntentions] = useState<Intention[] | null>(null);
  const [intentionsError, setIntentionsError] = useState<string | null>(null);

  const fetchEvents = useCallback(async (): Promise<CalendarEvent[]> => {
    const res = await api.calendar.list(start, end);
    if (res.error) throw new Error(res.error);
    return res.events ?? [];
  }, [start, end]);

  const {
    data: events,
    loading: eventsLoading,
    error: eventsError,
    refetch: refetchEvents,
  } = useCachedFetch<CalendarEvent[]>("today:events", fetchEvents, { ttl: 2 * 60 * 1000 });

  const {
    data: courses,
    loading: coursesLoading,
    error: coursesError,
  } = useCachedFetch<ScheduleCourse[]>(
    "schedule:today",
    useCallback(async () => {
      const res = await api.schedule.get();
      if (res.error) throw new Error(res.error);
      return res.courses ?? [];
    }, []),
    { ttl: 10 * 60 * 1000 }
  );

  const now = new Date();
  const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const dayCourses = (courses ?? [])
    .filter((c) => {
      const d = new Date(c.start);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` === todayKey;
    })
    .sort((a, b) => a.start - b.start);

  const loadLocal = useCallback(() => {
    import("@/app/actions/reminders")
      .then(({ loadReminders }) => loadReminders())
      .then((data) => setReminders(data.reminders))
      .catch((err) => setRemindersError(err instanceof Error ? err.message : "Erreur"));
    import("@/app/actions/intentions")
      .then(({ loadIntentions }) => loadIntentions())
      .then((data) => setIntentions(data.intentions))
      .catch((err) => setIntentionsError(err instanceof Error ? err.message : "Erreur"));
  }, []);

  // Premier chargement des rappels et relances (l'agenda passe par useCachedFetch).
  useEffect(() => {
    loadLocal();
  }, [loadLocal]);

  const todayReminders = (reminders ?? [])
    .filter((r) => r.status === "pending" && new Date(r.dueAt).getTime() <= new Date(end).getTime())
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  const todayIntentions = (intentions ?? [])
    .filter((i) => i.status === "pending" && new Date(i.dueAt).getTime() <= new Date(end).getTime())
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());

  const dayEvents = (events ?? []).sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const localLoading = reminders === null && intentions === null;
  const everythingEmpty =
    !localLoading &&
    todayReminders.length === 0 &&
    todayIntentions.length === 0 &&
    !eventsLoading &&
    (dayEvents.length === 0 || !!eventsError) &&
    !coursesLoading &&
    (dayCourses.length === 0 || !!coursesError);

  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto max-w-3xl px-5 pb-24 pt-12 sm:px-6 sm:pb-[152px] sm:pt-[88px]">
          <PageHeader
            title="Aujourd'hui"
            description="Rappels, agenda et relances de la journée, rassemblés au même endroit."
          />

          {everythingEmpty ? (
            <div className="max-w-[34rem]">
              <h2 className="font-display text-[length:var(--t-lead)] font-semibold tracking-[-0.02em] text-[var(--text-1)]">
                Rien de prévu
              </h2>
              <p className="mt-2 text-[length:var(--t-body)] leading-relaxed text-[var(--text-2)]">
                Aucun rappel, événement ou relance pour aujourd&apos;hui. Profites-en.
              </p>
              <Link href="/chat" className="ui-btn ui-btn--ghost mt-6">
                Ouvrir la Console
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-[104px]">
              {/* Rappels */}
              <section>
                <SectionTitle href="/reminders">Rappels</SectionTitle>
                {remindersError && (
                  <p className="ui-mono mt-3 text-[var(--danger)]">{remindersError}</p>
                )}
                {reminders === null ? (
                  <div className="mt-4 space-y-1.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                ) : todayReminders.length === 0 ? (
                  <p className="mt-4 text-[length:var(--t-small)] text-[var(--text-3)]">
                    Aucun rappel pour aujourd&apos;hui.
                  </p>
                ) : (
                  <RowList>
                    {todayReminders.map((r) => (
                      <li key={r.id} className="border-b border-[var(--line)]">
                        <Row
                          time={formatTime(r.dueAt)}
                          title={r.title}
                          late={isLate(r.dueAt)}
                          href="/reminders"
                        />
                      </li>
                    ))}
                  </RowList>
                )}
              </section>

              {/* Agenda */}
              <section>
                <SectionTitle href="/calendar">Agenda</SectionTitle>
                {eventsError ? (
                  <div className="mt-4 flex flex-col gap-3 border-l border-[var(--danger)] pl-4">
                    <span className="text-[length:var(--t-small)] text-[var(--danger)]">
                      Impossible de charger l&apos;agenda : {eventsError.message}
                    </span>
                    <span className="text-[length:var(--t-small)] text-[var(--text-2)]">
                      Vérifie que ton compte Google est connecté dans les Paramètres.
                    </span>
                    <div className="flex flex-wrap items-center gap-3">
                      <a
                        href="/api/auth/google?type=calendar"
                        className="ui-mono inline-flex items-center gap-1.5 text-[var(--text-2)] transition-colors duration-150 hover:text-[var(--text-1)]"
                      >
                        <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.6} />
                        Connecter le calendrier
                      </a>
                      <button
                        onClick={() => void refetchEvents()}
                        className="ui-mono inline-flex items-center gap-1.5 text-[var(--text-2)] transition-colors duration-150 hover:text-[var(--text-1)]"
                      >
                        <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.6} />
                        Réessayer
                      </button>
                    </div>
                  </div>
                ) : eventsLoading && dayEvents.length === 0 ? (
                  <div className="mt-4 space-y-1.5">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                ) : dayEvents.length === 0 ? (
                  <p className="mt-4 text-[length:var(--t-small)] text-[var(--text-3)]">
                    Aucun événement aujourd&apos;hui.
                  </p>
                ) : (
                  <RowList>
                    {dayEvents.map((e) => (
                      <li key={e.id} className="border-b border-[var(--line)]">
                        <Row
                          time={formatTime(e.start)}
                          title={e.summary}
                          meta={e.location ?? undefined}
                          href="/calendar"
                        />
                      </li>
                    ))}
                  </RowList>
                )}
              </section>

              {/* Cours */}
              <section>
                <SectionTitle href="/schedule">Cours</SectionTitle>
                {coursesError && (
                  <p className="ui-mono mt-3 text-[var(--danger)]">{coursesError.message}</p>
                )}
                {coursesLoading && dayCourses.length === 0 ? (
                  <div className="mt-4 space-y-1.5">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                ) : dayCourses.length === 0 ? (
                  <p className="mt-4 text-[length:var(--t-small)] text-[var(--text-3)]">
                    Aucun cours aujourd&apos;hui.
                  </p>
                ) : (
                  <RowList>
                    {dayCourses.map((c) => (
                      <li key={`${c.uuid}-${c.start}`} className="border-b border-[var(--line)]">
                        <Row
                          time={formatTime(new Date(c.start).toISOString())}
                          title={c.subject}
                          meta={c.room || undefined}
                          href="/schedule"
                        />
                      </li>
                    ))}
                  </RowList>
                )}
              </section>

              {/* Relances */}
              <section>
                <SectionTitle href="/week">Relances</SectionTitle>
                {intentionsError && (
                  <p className="ui-mono mt-3 text-[var(--danger)]">{intentionsError}</p>
                )}
                {intentions === null ? (
                  <div className="mt-4 space-y-1.5">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <Skeleton key={i} className="h-9 w-full" />
                    ))}
                  </div>
                ) : todayIntentions.length === 0 ? (
                  <p className="mt-4 text-[length:var(--t-small)] text-[var(--text-3)]">
                    Aucune relance aujourd&apos;hui.
                  </p>
                ) : (
                  <RowList>
                    {todayIntentions.map((i) => (
                      <li key={i.id} className="border-b border-[var(--line)]">
                        <Row
                          time={formatTime(i.dueAt)}
                          title={i.subject}
                          late={isLate(i.dueAt)}
                          href="/week"
                        />
                      </li>
                    ))}
                  </RowList>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
