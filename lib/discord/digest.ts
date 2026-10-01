import type { DailyBrief } from "@/lib/types";
import type { BriefDigest } from "./types";

/**
 * Phrase de tête du brief IA, utilisée comme titre de la carte image :
 * première ligne porteuse de contenu, débarrassée du markdown.
 */
export function extractFocus(summary: string, max = 96): string | undefined {
  const line = summary
    .split("\n")
    .map((l) =>
      l
        .replace(/^#{1,6}\s*/, "")
        .replace(/^\s*[-*+]\s+/, "")
        .replace(/^\s*\d+\.\s+/, "")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/\*(.+?)\*/g, "$1")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
        .trim()
    )
    .find((l) => l.length > 3);
  if (!line) return undefined;
  return line.length <= max ? line : `${line.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Digest de la carte Discord à partir du brief persisté : aucune requête
 * supplémentaire (Gmail, Google Calendar, API IA) au moment de l'envoi.
 */
export function digestFromBrief(brief: DailyBrief, summary: string): BriefDigest {
  return {
    date: brief.date,
    focus: extractFocus(summary),
    weather: brief.weather ?? null,
    courses: brief.events
      .filter((e) => e.type === "course")
      .map((e) => ({ title: e.title, time: e.time, location: e.location })),
    reminders: brief.reminders.map((r) => r.title),
    agenda: brief.events
      .filter((e) => e.type !== "course" && e.type !== "reminder")
      .map((e) => (e.time ? `${e.time} — ${e.title}` : e.title)),
    urgentEmails: (brief.urgentEmails ?? []).map((e) => e.subject),
    unreadCount: brief.emails.length,
    leetcode: brief.leetcodeDaily
      ? `${brief.leetcodeDaily.title} (${brief.leetcodeDaily.difficulty})`
      : null,
  };
}
