"use client";

import { useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, Clock, MapPin, Video } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCachedFetch } from "@/lib/cache";
import { useModuleHomeCards } from "@backstage/module-kit";
import { useNow } from "@/lib/clock";
import { getHomeOverview } from "@/app/actions/home";
import { CALENDAR_CACHE_KEY, fetchUpcomingCalendarEvents } from "@/components/widgets/CalendarWidget";
import { GMAIL_CACHE_KEY, fetchInboxMessages } from "@/components/widgets/GmailWidget";
import {
  buildChips,
  buildShortcuts,
  countdown,
  dayLabel,
  formatDuration,
  greeting,
  timeRange,
} from "@/components/chat/home-hero-data";
import type { Chip, Focus } from "@/components/chat/home-hero-data";
import { formatTime } from "@/lib/date";
import type { HomeOverview } from "@/lib/types";

const TONE_TEXT: Record<Chip["tone"], string> = {
  accent: "text-[var(--text-3)]",
  cool: "text-[var(--text-3)]",
  warm: "text-[var(--text-3)]",
  danger: "text-[var(--danger)]",
};

export function HomeHero({
  onPrompt,
  disabled,
}: {
  onPrompt: (prompt: string) => void;
  disabled: boolean;
}) {
  // Horloge client via useSyncExternalStore : le snapshot serveur vaut 0, donc
  // le HTML rendu par le serveur est identique au premier rendu client (aucune
  // erreur d'hydratation) et la salutation apparaît dès la première frame.
  const now = useNow();
  const homeCards = useModuleHomeCards();

  const { data: overview } = useCachedFetch<HomeOverview>("home:overview", getHomeOverview, {
    ttl: 60_000,
  });
  // Cache partagé avec les widgets du panneau de droite : aucune requête en plus.
  const { data: events } = useCachedFetch(CALENDAR_CACHE_KEY, fetchUpcomingCalendarEvents, {
    ttl: 2 * 60 * 1000,
  });
  const { data: messages } = useCachedFetch(GMAIL_CACHE_KEY, fetchInboxMessages, {
    ttl: 2 * 60 * 1000,
  });

  const unreadMail = useMemo(
    () => (messages ?? []).filter((m) => m.unread).length,
    [messages]
  );

  const focus = useMemo<Focus | null>(() => {
    if (now === 0) return null;

    if (overview?.currentCourse) {
      const c = overview.currentCourse;
      return {
        title: c.subject,
        start: c.start,
        end: c.end,
        location: c.room,
        remote: c.remote,
        origin: "course",
        live: true,
        href: "/schedule",
      };
    }

    const course: Focus | null = overview?.nextCourse
      ? {
          title: overview.nextCourse.subject,
          start: overview.nextCourse.start,
          end: overview.nextCourse.end,
          location: overview.nextCourse.room,
          remote: overview.nextCourse.remote,
          origin: "course",
          live: false,
          href: "/schedule",
        }
      : null;

    const event: Focus | null = (events ?? [])
      .filter((e) => new Date(e.end).getTime() > now)
      .sort((a, b) => +new Date(a.start) - +new Date(b.start))
      .flatMap((e) => [
        {
          title: e.summary,
          start: +new Date(e.start),
          end: +new Date(e.end),
          location: e.location ?? "",
          remote: false,
          origin: "event" as const,
          live: +new Date(e.start) <= now,
          href: "/calendar",
        },
      ])[0] ?? null;

    return [course, event]
      .filter((f): f is Focus => f !== null)
      .sort((a, b) => a.start - b.start)[0] ?? null;
  }, [overview, events, now]);

  const shortcuts = useMemo(
    () => buildShortcuts(overview, focus, unreadMail),
    [overview, focus, unreadMail]
  );
  const chips = useMemo(() => buildChips(overview, unreadMail), [overview, unreadMail]);

  const briefing = useMemo(() => {
    if (now === 0) return "Je m'occupe du reste : Gmail, agenda, rappels, mémoire, recherche.";
    const minutes = focus ? Math.round((focus.start - now) / 60_000) : null;
    if (focus?.live) return "Tu es en plein dedans — je gère le reste pendant ce temps.";
    if (focus && minutes !== null && minutes > 0 && minutes <= 60) {
      return `Ça commence ${countdown(focus.start, now)}. Veux-tu que je te prépare ?`;
    }
    if (overview && overview.remindersLateCount > 0) {
      const late = overview.remindersLateCount;
      return `${late} rappel${late > 1 ? "s" : ""} en retard${late > 1 ? "" : "e"} — on commence par là ?`;
    }
    if (focus) return "Rien d'urgent avant : la journée est à toi.";
    if (overview && overview.remindersToday.length > 0) {
      return "Rien au programme côté agenda, juste tes rappels du jour.";
    }
    if (overview && overview.leetcodeConfigured) {
      return overview.leetcodeStreak > 0
        ? `Agenda libre — parfait pour tenir ta série de ${overview.leetcodeStreak} jours.`
        : "Agenda libre — le bon moment pour relancer ta série LeetCode.";
    }
    if (overview) return "Aucun rendez-vous aujourd'hui. Demande-moi ce que tu veux.";
    return "Je m'occupe du reste : Gmail, agenda, rappels, mémoire, recherche.";
  }, [focus, overview, now]);

  const eyebrow = useMemo(() => {
    if (now === 0) return "";
    const date = new Date(now).toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    return `${date} · ${formatTime(new Date(now).toISOString())}`;
  }, [now]);

  return (
    <section aria-label="Accueil du chat" className="flex flex-col items-center text-center">
      {/* Badge détaillé suspendu au bord supérieur de la zone de défilement : le
          logo est posé sans padding haut, donc le tour de cou sort de l'écran —
          le bord de la fenêtre tient lieu de ligne de coupe et rien n'est rogné.
          En mobile seulement, une marge négative rogne son haut pour ne pas
          manger la hauteur utile. Le pivot du balancement est le bord haut de la
          boîte, c'est-à-dire exactement cette ligne de coupe. */}
      <div className="home-rise relative flex justify-center -mt-9 sm:mt-0">
        <div className="relative w-[176px] sm:w-[240px]">
          <Image
            src="/backstage-logo.png"
            alt="BACKSTAGE"
            width={1254}
            height={1254}
            sizes="(min-width: 640px) 240px, 176px"
            loading="eager"
            fetchPriority="high"
            className="w-full h-auto"
          />
        </div>
      </div>

      <p
        className="home-rise mt-7 flex items-center gap-2 ui-mono text-[var(--text-3)]"
        style={{ animationDelay: "60ms" }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
        {eyebrow || "Backstage"}
      </p>

      <h1
        className="home-rise mt-3 font-display font-semibold tracking-[-0.03em] text-[length:var(--t-head)] leading-[1.02] text-[var(--text-1)] text-balance"
        style={{ animationDelay: "110ms" }}
      >
        {now > 0 ? (
          <span className="home-swap inline-block">
            {greeting(new Date(now).getHours())}
            {overview?.name ? ` ${overview.name}` : ""}
          </span>
        ) : (
          "Que puis-je faire pour toi ?"
        )}
      </h1>

      <p
        key={briefing}
        className="home-rise mt-3 text-[length:var(--t-body)] text-[var(--text-2)] max-w-[32rem] leading-relaxed balance"
        style={{ animationDelay: "160ms" }}
      >
        {briefing}
        {now > 0 && (
          <span className="home-caret" aria-hidden>
            ▍
          </span>
        )}
      </p>

      {focus && (
        <div
          className="home-rise mt-8 w-full max-w-lg text-left"
          style={{ animationDelay: "220ms" }}
        >
          <div className="relative ui-plate flex items-start gap-4 px-5 py-4">
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 ui-mono text-[var(--plate-3)]">
                {focus.live ? (
                  <span className="rounded-full px-2 py-0.5 bg-[var(--plate-acc-bg)] text-[var(--plate-acc-ink)]">
                    en cours
                  </span>
                ) : (
                  <span className="text-[var(--plate-acc-ink)]">
                    {countdown(focus.start, now)} · {dayLabel(focus.start, now)}{timeRange(focus.start, focus.end)}
                  </span>
                )}
                {focus.live && (
                  <span>{timeRange(focus.start, focus.end)}</span>
                )}
              </p>
              <p className="mt-2 font-display font-semibold tracking-[-0.03em] text-[length:var(--t-lead)] leading-[1.05] text-[var(--plate-ink)] truncate">
                {focus.title}
              </p>
              <p className="mt-2 flex items-center gap-2.5 text-[length:var(--t-small)] text-[var(--plate-3)]">
                {focus.location && (
                  <span className="flex items-center gap-1.5 truncate">
                    {focus.remote ? <Video className="w-3 h-3 shrink-0" /> : <MapPin className="w-3 h-3 shrink-0" />}
                    <span className="truncate">{focus.location}</span>
                  </span>
                )}
                {focus.remote && !focus.location && (
                  <span className="flex items-center gap-1.5">
                    <Video className="w-3 h-3" />
                    Distanciel
                  </span>
                )}
                <span className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3" />
                  {formatDuration(focus.end - focus.start)}
                </span>
              </p>
            </div>
            <Link
              href={focus.href}
              className="shrink-0 mt-0.5 w-8 h-8 rounded-full flex items-center justify-center text-[var(--plate-3)] hover:text-[var(--plate-acc-ink)] hover:bg-[var(--plate-acc-bg)] transition-colors duration-150"
              title="Ouvrir"
            >
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}

      {chips.length > 0 && (
        <div
          className="home-rise mt-3 flex flex-wrap items-center justify-center gap-1.5"
          style={{ animationDelay: "270ms" }}
        >
          {chips.map((c) => {
            const content = (
              <>
                <c.icon className={cn("w-3 h-3 shrink-0", TONE_TEXT[c.tone])} />
                <span className={c.tone === "danger" ? "text-[var(--danger)]" : "text-[var(--text-2)]"}>
                  {c.label}
                </span>
              </>
            );
            return c.href ? (
              <Link key={c.label} href={c.href} className="ui-chip transition-colors duration-150">
                {content}
              </Link>
            ) : (
              <span key={c.label} className="ui-chip">
                {content}
              </span>
            );
          })}
        </div>
      )}

      <section
        aria-label="Raccourcis"
        className="home-rise mt-9 w-full max-w-lg"
        style={{ animationDelay: "330ms" }}
      >
        <div className="flex items-center gap-3 mb-3 px-0.5">
          <span className="ui-mono text-[var(--text-3)]">
            Raccourcis
          </span>
          <span className="flex-1 h-px bg-[var(--line)]" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {shortcuts.map((s) => (
            <button
              key={s.label}
              onClick={() => void onPrompt(s.label)}
              disabled={disabled}
              className="ui-chip ui-chip--tile group w-full gap-2.5 text-left transition-colors duration-150 disabled:opacity-40"
            >
              <s.icon className="w-4 h-4 shrink-0 mt-0.5 text-[var(--text-3)] group-hover:text-[var(--accent)] transition-colors duration-150" />
              <span className="leading-relaxed line-clamp-2 text-[var(--text-2)]">{s.label}</span>
              <ArrowUpRight className="w-3.5 h-3.5 shrink-0 mt-0.5 ml-auto self-center text-[var(--text-4)] opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
            </button>
          ))}
        </div>
      </section>

      {homeCards.length > 0 && (
        <div
          className="home-rise mt-4 w-full max-w-lg space-y-3"
          style={{ animationDelay: "390ms" }}
        >
          {homeCards.map((card) => (
            <div key={card.id}>{card.node}</div>
          ))}
        </div>
      )}
    </section>
  );
}
