import type { Intention, Reminder, ScheduleCourse } from "@/lib/types";

/** Ligne de cours telle qu'exposée dans le brief persisté. */
export interface BriefCourse {
  title: string;
  time?: string;
  location?: string;
}

/** Résumé structuré de la journée, alimente la carte image du daily brief. */
export interface BriefDigest {
  date: string;
  /** Phrase de tête extraite du brief IA (titre de la carte). */
  focus?: string;
  weather: string | null;
  courses: BriefCourse[];
  reminders: string[];
  agenda: string[];
  urgentEmails: string[];
  unreadCount: number;
  leetcode: string | null;
}

export type DiscordEvent =
  | { kind: "daily-brief"; summary: string; digest: BriefDigest }
  | { kind: "course"; course: ScheduleCourse; leadMin: number }
  | { kind: "reminder"; reminder: Reminder }
  | { kind: "intention"; intention: Intention }
  | {
      kind: "alert";
      module: string;
      message: string;
      detail?: string;
      level: "error" | "warn";
    }
  | { kind: "test" };

export type DiscordEventKind = DiscordEvent["kind"];

/** Un événement prêt à partir : embed construit + carte PNG attachée. */
export interface DiscordPayload {
  embed: DiscordEmbed;
  image: { filename: string; data: Uint8Array } | null;
}

export interface DiscordEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

export interface DiscordEmbed {
  author?: { name: string };
  title?: string;
  description?: string;
  color?: number;
  fields?: DiscordEmbedField[];
  image?: { url: string };
  footer?: { text: string };
  timestamp?: string;
}

export interface DiscordSendResult {
  sent: boolean;
  /** Renseigné quand rien n'est parti : configuration absente ou erreur API. */
  reason?: string;
}
