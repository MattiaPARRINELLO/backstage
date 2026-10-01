import { toHHMM } from "@/lib/utils";
import type {
  BriefCourse,
  BriefDigest,
  DiscordEmbed,
  DiscordEmbedField,
  DiscordEvent,
} from "./types";

/** Accents BACKSTAGE (voir DESIGN.md) transposés en couleurs d'embed. */
const COLORS = {
  brief: 0xd4a373,
  course: 0x7aa2f7,
  reminder: 0xd4a373,
  intention: 0xcba6f7,
  alert: 0xf38ba8,
  warning: 0xf9e2af,
  ok: 0xa6e3a1,
} as const;

const LIMITS = {
  title: 256,
  description: 4096,
  fieldName: 256,
  fieldValue: 1024,
  footer: 2048,
} as const;

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1).trimEnd()}…`;
}

/**
 * Markdown IA → markdown Discord. Discord ne rend que gras/italique/code/citations :
 * les titres deviennent du gras, les puces un point médian, les tableaux du texte.
 */
export function toDiscordMarkdown(value: string): string {
  // Ligne de séparation de tableau (|---|:--:|) : supprimée avec son saut de
  // ligne, sinon les lignes du tableau se retrouvent collées.
  const isSeparator = (line: string) => {
    const trimmed = line.trim();
    return trimmed.includes("-") && /^\|?[\s:|-]+\|?$/.test(trimmed);
  };

  return value
    .replace(/```[a-z]*\n?/gi, "`")
    .split("\n")
    .filter((line) => !isSeparator(line))
    .map((line) => {
      const trimmed = line.trim();
      if (trimmed.startsWith("|")) {
        return trimmed
          .split("|")
          .map((cell) => cell.trim())
          .filter(Boolean)
          .join(" · ");
      }
      const heading = trimmed.match(/^#{1,6}\s*(.+)$/);
      if (heading) return `**${heading[1].trim()}**`;
      if (/^[-*+]\s+/.test(trimmed)) return `• ${trimmed.replace(/^[-*+]\s+/, "")}`;
      return line;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function field(name: string, values: string[], inline = false): DiscordEmbedField | null {
  const filtered = values.filter((v) => v.trim().length > 0);
  if (!filtered.length) return null;
  return {
    name: truncate(name, LIMITS.fieldName),
    value: truncate(filtered.join("\n"), LIMITS.fieldValue),
    inline,
  };
}

function compact(fields: (DiscordEmbedField | null)[]): DiscordEmbedField[] {
  return fields.filter((f): f is DiscordEmbedField => f !== null).slice(0, 25);
}

function courseLine(course: BriefCourse): string {
  const head = course.time ? `\`${course.time}\` ` : "";
  return `${head}${course.title}${course.location ? ` · ${course.location}` : ""}`;
}

function longDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** Champs d'embed du brief : cours, rappels, agenda, mails, LeetCode. */
export function briefFields(digest: BriefDigest): DiscordEmbedField[] {
  const mails = [
    ...digest.urgentEmails.slice(0, 5).map((s) => `• ${truncate(s, 120)}`),
    digest.unreadCount > digest.urgentEmails.length
      ? `+${digest.unreadCount - digest.urgentEmails.length} autres non lus`
      : "",
  ];
  return compact([
    field("Cours", digest.courses.slice(0, 4).map(courseLine)),
    field("Rappels", digest.reminders.slice(0, 6).map((r) => `• ${truncate(r, 120)}`)),
    field("Agenda", digest.agenda.slice(0, 6).map((a) => `• ${truncate(a, 120)}`)),
    field("Boîte mail", mails),
    field("LeetCode", digest.leetcode ? [digest.leetcode] : []),
  ]);
}

export function buildEmbed(event: DiscordEvent): DiscordEmbed {
  switch (event.kind) {
    case "daily-brief": {
      const summary = toDiscordMarkdown(event.summary);
      const date = longDate(event.digest.date);
      return {
        author: { name: `BACKSTAGE · Brief du ${date}` },
        title: event.digest.weather ? `Météo : ${event.digest.weather}` : "Brief du jour",
        description: truncate(summary, LIMITS.description),
        color: COLORS.brief,
        fields: briefFields(event.digest),
        footer: { text: "backstage · brief du jour" },
        timestamp: new Date().toISOString(),
      };
    }

    case "course": {
      const { course, leadMin } = event;
      const start = new Date(course.start);
      const end = new Date(course.end);
      const at = `${toHHMM(start.toISOString())} – ${toHHMM(end.toISOString())}`;
      return {
        author: { name: `BACKSTAGE · Dans ${leadMin} min` },
        title: truncate(course.subject, LIMITS.title),
        description: [course.lessonType, course.group].filter(Boolean).join(" · ") || undefined,
        color: COLORS.course,
        fields: compact([
          field("Horaire", [at], true),
          field("Salle", [course.room || (course.remote ? "À distance" : "Non précisée")], true),
          field("Enseignant", [course.teacher || "Non précisé"], true),
        ]),
        footer: { text: "backstage · emploi du temps CESAR" },
        timestamp: start.toISOString(),
      };
    }

    case "reminder": {
      const { reminder } = event;
      const due = new Date(reminder.dueAt);
      return {
        author: { name: "BACKSTAGE · Rappel" },
        title: truncate(reminder.title, LIMITS.title),
        description: reminder.notes
          ? truncate(toDiscordMarkdown(reminder.notes), LIMITS.description)
          : undefined,
        color: COLORS.reminder,
        fields: compact([
          field(
            "Échéance",
            [
              due.toLocaleString("fr-FR", {
                weekday: "short",
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              }),
            ],
            true
          ),
          field("Récurrence", [reminder.recurrence ?? "ponctuelle"], true),
        ]),
        footer: { text: "Ouvre backstage pour marquer comme fait" },
        timestamp: due.toISOString(),
      };
    }

    case "intention": {
      const { intention } = event;
      return {
        author: { name: "BACKSTAGE · Relance" },
        title: truncate(intention.subject, LIMITS.title),
        description: intention.message
          ? truncate(toDiscordMarkdown(intention.message), LIMITS.description)
          : `Tu voulais relancer sur « ${intention.subject} ».`,
        color: COLORS.intention,
        footer: { text: "backstage · relance programmée" },
        timestamp: new Date(intention.dueAt).toISOString(),
      };
    }

    case "alert": {
      const level = event.level === "warn" ? "Avertissement" : "Erreur";
      return {
        author: { name: `BACKSTAGE · ${level} technique` },
        title: truncate(`[${event.module}] ${event.message}`, LIMITS.title),
        description: event.detail
          ? truncate(`\`\`\`\n${event.detail}\n\`\`\``, LIMITS.description)
          : undefined,
        color: event.level === "warn" ? COLORS.warning : COLORS.alert,
        footer: { text: "backstage · supervision" },
        timestamp: new Date().toISOString(),
      };
    }

    case "test": {
      return {
        author: { name: "BACKSTAGE · Test de connexion" },
        title: "Canal Discord opérationnel",
        description:
          "Si tu lis ce message et que la carte s'affiche, les notifications BACKSTAGE (brief du jour, cours, rappels, relances) arriveront ici.",
        color: COLORS.ok,
        footer: { text: "backstage · /settings" },
        timestamp: new Date().toISOString(),
      };
    }
  }
}

export { COLORS, LIMITS };
