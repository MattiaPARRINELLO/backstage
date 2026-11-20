// Donnees de l'accueil du chat : libelles de temps, raccourcis et puces
// contextuelles. Module pur, sans rendu ni effet de bord : le composant fournit
// l'horloge et les donnees deja chargees, ce module ne fait que les mettre en
// mots. Il change quand le vocabulaire de l'accueil change, pas quand sa mise en
// page change.

import { Bell, Brain, CalendarDays, Flame, Globe, Mail, Sparkles } from "lucide-react";
import { DEFAULT_SHORTCUTS } from "@/components/chat/chat-data";
import { formatTime } from "@/lib/date";
import type { HomeOverview } from "@/lib/types";

export type Icon = typeof Sparkles;

export interface Focus {
  title: string;
  start: number;
  end: number;
  location: string;
  remote: boolean;
  origin: "course" | "event";
  live: boolean;
  href: string;
}

export interface Shortcut {
  label: string;
  icon: Icon;
}

export interface Chip {
  icon: Icon;
  label: string;
  href?: string;
  tone: "accent" | "cool" | "warm" | "danger";
}

export function greeting(hour: number): string {
  if (hour < 6) return "Encore debout ?";
  if (hour < 12) return "Bonjour";
  if (hour < 18) return "Bon après-midi";
  if (hour < 23) return "Bonsoir";
  return "Bonne nuit";
}

export function timeRange(start: number, end: number): string {
  return `${formatTime(new Date(start).toISOString())} – ${formatTime(new Date(end).toISOString())}`;
}

export function countdown(target: number, now: number): string {
  const min = Math.round((target - now) / 60_000);
  if (min <= 0) return "maintenant";
  if (min < 60) return `dans ${min} min`;
  const hours = Math.floor(min / 60);
  const rest = min % 60;
  if (hours < 24) return rest === 0 ? `dans ${hours} h` : `dans ${hours} h ${String(rest).padStart(2, "0")}`;
  const days = Math.round(hours / 24);
  return days <= 1 ? "demain" : `dans ${days} jours`;
}

export function formatDuration(ms: number): string {
  const min = Math.max(1, Math.round(ms / 60_000));
  if (min < 60) return `${min} min`;
  const hours = Math.floor(min / 60);
  const rest = min % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

export function isSameDay(a: number, b: number): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

export function dayLabel(start: number, now: number): string {
  if (isSameDay(start, now)) return "";
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (isSameDay(start, tomorrow.getTime())) return "demain · ";
  return `${new Date(start).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })} · `;
}

export function buildShortcuts(
  overview: HomeOverview | undefined,
  focus: Focus | null,
  unreadMail: number
): Shortcut[] {
  const candidates: Shortcut[] = [];

  if (overview && (overview.remindersToday.length > 0 || overview.remindersLateCount > 0)) {
    candidates.push({ label: "Qu'est-ce que je dois faire aujourd'hui ?", icon: Sparkles });
  }
  if (focus?.origin === "course") {
    candidates.push({ label: `Que dois-je préparer pour ${focus.title} ?`, icon: CalendarDays });
  }
  if (focus?.origin === "event") {
    candidates.push({ label: `Prépare-moi pour « ${focus.title} »`, icon: CalendarDays });
  }
  if (unreadMail > 0) {
    candidates.push({ label: "Résume mes mails non lus", icon: Mail });
  }
  if (overview && overview.pendingFollowups > 0) {
    candidates.push({ label: "Où en sont mes relances en attente ?", icon: Globe });
  }
  if (overview && overview.leetcodeConfigured && !overview.leetcodeSolvedToday) {
    candidates.push({ label: "Aide-moi sur un algo LeetCode", icon: Brain });
  }

  const seen = new Set<string>();
  return [...candidates, ...DEFAULT_SHORTCUTS]
    .filter((s) => (seen.has(s.label) ? false : seen.add(s.label)))
    .slice(0, 4);
}

export function buildChips(overview: HomeOverview | undefined, unreadMail: number): Chip[] {
  if (!overview) return [];
  const chips: Chip[] = [];

  const remainingCourses = overview.laterToday.length;
  if (remainingCourses > 0) {
    chips.push({
      icon: CalendarDays,
      label: `${remainingCourses} cours restant${remainingCourses > 1 ? "s" : ""}`,
      href: "/schedule",
      tone: "accent",
    });
  }

  const dueToday = overview.remindersToday.length;
  const late = overview.remindersLateCount;
  if (dueToday > 0 || late > 0) {
    const total = dueToday + late;
    const plural = total > 1 ? "s" : "";
    const label =
      dueToday === 0
        ? `${late} rappel${late > 1 ? "s" : ""} en retard`
        : late === 0
          ? `${total} rappel${plural} aujourd'hui`
          : `${total} rappel${plural} · ${late} en retard`;
    chips.push({
      icon: Bell,
      label,
      href: "/reminders",
      tone: late > 0 ? "danger" : "warm",
    });
  }

  if (overview.pendingFollowups > 0) {
    chips.push({
      icon: Globe,
      label: `${overview.pendingFollowups} relance${overview.pendingFollowups > 1 ? "s" : ""}`,
      href: "/today",
      tone: "cool",
    });
  }

  // Comptage honnête : la liste partagée est plafonnée par l'API (10 mails),
  // donc on affiche « 10+ » plutôt qu'un total inventé.
  if (unreadMail > 0) {
    const capped = unreadMail >= 10;
    chips.push({
      icon: Mail,
      label: `${unreadMail}${capped ? "+" : ""} mail${unreadMail > 1 ? "s" : ""} non lu${unreadMail > 1 ? "s" : ""}`,
      href: "/gmail",
      tone: "accent",
    });
  }

  // La puce dépend du compte configuré, pas de la série : à série 0 elle doit
  // rester visible, sinon un compte fraîchement branché disparaît de l'accueil.
  if (overview.leetcodeConfigured) {
    chips.push({
      icon: Flame,
      label: overview.leetcodeSolvedToday
        ? "résolu aujourd'hui"
        : overview.leetcodeStreak > 0
          ? `série ${overview.leetcodeStreak} j`
          : "LeetCode",
      href: "/leetcode",
      tone: overview.leetcodeSolvedToday ? "cool" : "warm",
    });
  }

  return chips;
}
