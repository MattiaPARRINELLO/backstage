"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Bell,
  CalendarDays,
  MapPin,
  Video,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCachedFetch } from "@/lib/cache";
import { useNow } from "@/lib/clock";
import { getHomeOverview } from "@/app/actions/home";
import { CALENDAR_CACHE_KEY, fetchUpcomingCalendarEvents } from "@/components/widgets/CalendarWidget";
import { formatTime } from "@/lib/date";
import type { HomeOverview } from "@/lib/types";

type Kind = "course" | "event" | "reminder";

interface FluxItem {
  id: string;
  kind: Kind;
  title: string;
  place: string;
  detail: string;
  /** Timestamps ms epoch */
  start: number;
  end: number;
  live: boolean;
  late: boolean;
  remote: boolean;
  href: string;
}

const KIND_LABEL: Record<Kind, string> = {
  course: "Cours",
  event: "Agenda",
  reminder: "Rappel",
};

const MAX_EVENTS = 12;
const MAX_LATE = 4;

function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function dayLabel(ms: number, now: number): string {
  if (dayKey(ms) === dayKey(now)) return "Aujourd'hui";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dayKey(ms) === dayKey(tomorrow.getTime())) return "Demain";
  return new Date(ms).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function formatDuration(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  const rest = min % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

/**
 * Fusionne cours, événements agenda et rappels du jour en une liste unique
 * triée. Seuls les éléments non terminés sont retenus : le flux regarde devant.
 */
function buildItems(
  overview: HomeOverview | undefined,
  events: { id: string; summary: string; start: string; end: string; location?: string }[],
  now: number
): FluxItem[] {
  if (!overview) return [];

  const courses = [
    ...(overview.currentCourse ? [overview.currentCourse] : []),
    ...overview.laterToday,
    ...overview.coursesLater,
  ].filter((c) => c.end > now);

  const courseItems: FluxItem[] = courses.map((c, i) => ({
    id: `c-${c.start}-${i}`,
    kind: "course",
    title: c.subject,
    place: c.room,
    detail: [c.teacher, c.lessonType].filter(Boolean).join(" · "),
    start: c.start,
    end: c.end,
    live: c.start <= now,
    late: false,
    remote: c.remote,
    href: "/schedule",
  }));

  const eventItems: FluxItem[] = events
    .filter((e) => +new Date(e.end) > now)
    .slice(0, MAX_EVENTS)
    .map((e) => ({
      id: `e-${e.id}`,
      kind: "event" as const,
      title: e.summary,
      place: e.location ?? "",
      detail: "",
      start: +new Date(e.start),
      end: +new Date(e.end),
      live: +new Date(e.start) <= now,
      late: false,
      remote: false,
      href: "/calendar",
    }));

  // Les rappels déjà échus aujourd'hui restent dans le flux (en rouge) : ils
  // n'ont pas disparu, ils sont en retard.
  const reminderItems: FluxItem[] = overview.remindersToday.map((r, i) => ({
    id: `r-${i}-${r.dueAt}`,
    kind: "reminder" as const,
    title: r.title,
    place: "",
    detail: "",
    start: +new Date(r.dueAt),
    end: +new Date(r.dueAt),
    live: false,
    late: r.late,
    remote: false,
    href: "/reminders",
  }));

  return [...courseItems, ...eventItems, ...reminderItems].sort((a, b) => a.start - b.start);
}

/** Ligne de temps unifiée : cours + agenda + rappels, groupés par jour. */
export function FluxTimeline() {
  const now = useNow();
  const { data: overview } = useCachedFetch<HomeOverview>("home:overview", getHomeOverview, {
    ttl: 60_000,
  });
  const { data: events } = useCachedFetch(CALENDAR_CACHE_KEY, fetchUpcomingCalendarEvents, {
    ttl: 2 * 60 * 1000,
  });

  const items = buildItems(overview, events ?? [], now);

  const groups: { key: string; label: string; items: FluxItem[] }[] = [];
  for (const item of items) {
    const key = dayKey(item.start);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, label: dayLabel(item.start, now), items: [item] });
  }

  const late = overview?.remindersLate ?? [];
  const lateTotal = overview?.remindersLateCount ?? late.length;

  if (groups.length === 0 && late.length === 0) {
    return (
      <div className="py-10 text-center">
        <CalendarDays className="w-5 h-5 text-[var(--text-4)] mx-auto mb-3" />
        <p className="ui-mono text-[var(--text-3)]">Rien à venir cette semaine</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {late.length > 0 && <LateBlock items={late} total={lateTotal} />}

      {groups.map((g) => (
        <section key={g.key}>
          <SectionHeading label={g.label} count={g.items.length} />
          <ol className="mt-1 divide-y divide-[var(--line)]">
            {g.items.map((item) => (
              <li key={item.id}>
                <TimelineRow item={item} now={now} showNow={g.label === "Aujourd'hui"} />
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
}

function TimelineRow({ item, now, showNow }: { item: FluxItem; now: number; showNow: boolean }) {
  // La puce « maintenant » se place avant le premier élément à venir : elle
  // matérialise la frontière passé / à venir de la journée.
  const nowBefore = showNow && now > 0 && item.start > now;
  const past = item.end <= now;

  return (
    <>
      {nowBefore && <NowMarker />}
      <Link
        href={item.href}
        className={cn(
          "group flex items-start gap-3 py-3 transition-opacity duration-150",
          past && "opacity-45"
        )}
      >
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 ui-mono",
            item.late
              ? "bg-[var(--danger)]/10 text-[var(--danger)]"
              : item.live
                ? "bg-[var(--accent)] text-[var(--background)]"
                : "bg-[var(--accent)]/10 text-[var(--accent)]"
          )}
        >
          {formatTime(new Date(item.start).toISOString())}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-start gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 text-[length:var(--t-body)] leading-snug",
                item.live || item.late ? "font-medium text-[var(--text-1)]" : "text-[var(--text-2)]"
              )}
            >
              {item.title}
            </span>
            {item.live && <Tag tone="accent">en cours</Tag>}
            {item.late && <Tag tone="danger">en retard</Tag>}
            <ArrowUpRight className="w-3 h-3 shrink-0 mt-1 text-[var(--text-4)] opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
          </span>
          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-0.5 mt-1 ui-mono text-[var(--text-4)]">
            <span>{KIND_LABEL[item.kind]}</span>
            {item.end > item.start && (
              <span>{formatDuration(item.end - item.start)}</span>
            )}
            {item.place ? (
              <span className="flex items-center gap-1 min-w-0">
                {item.remote ? (
                  <Video className="w-3 h-3 shrink-0" />
                ) : (
                  <MapPin className="w-3 h-3 shrink-0" />
                )}
                <span className="truncate">{item.place}</span>
              </span>
            ) : (
              item.detail && <span className="truncate">{item.detail}</span>
            )}
          </span>
        </span>
      </Link>
    </>
  );
}

function NowMarker() {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="ui-mono rounded-full px-2 py-0.5 bg-[var(--accent)] text-[var(--background)]">
        maintenant
      </span>
      <span className="flex-1 h-px bg-[var(--accent)]/25" />
    </div>
  );
}

function Tag({ tone, children }: { tone: "accent" | "danger"; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "shrink-0 mt-1 ui-mono",
        tone === "accent" ? "text-[var(--accent)]" : "text-[var(--danger)]"
      )}
    >
      {children}
    </span>
  );
}

function LateBlock({ items, total }: { items: { title: string; dueAt: string }[]; total: number }) {
  const shown = items.slice(0, MAX_LATE);
  return (
    <section className="ui-tile overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <AlertTriangle className="w-3.5 h-3.5 text-[var(--danger)] shrink-0" />
        <span className="ui-mono text-[var(--danger)]">
          En retard
        </span>
        <span className="ml-auto ui-mono text-[var(--text-3)]">
          {total}
        </span>
      </div>
      <ul className="border-t border-[var(--line)] divide-y divide-[var(--line)]">
        {shown.map((r) => (
          <li key={`${r.title}-${r.dueAt}`}>
            <Link
              href="/reminders"
              className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-[var(--surface-2)] transition-colors duration-150"
            >
              <Bell className="w-3 h-3 text-[var(--danger)] shrink-0" />
              <span className="min-w-0 flex-1 text-[length:var(--t-small)] text-[var(--text-2)] truncate">
                {r.title}
              </span>
              <span className="shrink-0 ui-mono text-[var(--text-4)]">
                {new Date(r.dueAt).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {total > shown.length && (
        <Link
          href="/reminders"
          className="block px-3 py-2 ui-mono text-[var(--text-4)] hover:text-[var(--text-1)] border-t border-[var(--line)] transition-colors duration-150"
        >
          + {total - shown.length} autres
        </Link>
      )}
    </section>
  );
}

/** En-tête de section du panneau : libellé mono + filet + compteur. */
function SectionHeading({ label, count, live }: { label: string; count?: number; live?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex items-center gap-1.5 ui-mono text-[var(--text-3)]">
        {live && (
          <span className="relative flex w-1.5 h-1.5">
            <span className="absolute inset-0 rounded-full bg-[var(--accent)] animate-pulse-dot" />
            <span className="relative w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
          </span>
        )}
        {label}
      </span>
      {count !== undefined && count > 0 && (
        <span className="ui-mono text-[var(--text-4)]">{count}</span>
      )}
      <span className="flex-1 h-px bg-[var(--line)]" />
    </div>
  );
}
