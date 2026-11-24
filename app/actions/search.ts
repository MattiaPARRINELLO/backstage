"use server";

import { z } from "zod";

import { actionInput } from "@/lib/action";

import { getAccreditations } from "@/modules/accreditations";

import {
  getConcerts,
  getMemory,
  getReminders,
  getWatchLater,
  searchEmails,
} from "@/lib/storage";
import type { ConcertEvent, MemoryFact, Email, Reminder, WatchLaterItem, Accreditation } from "@/lib/types";

export interface UnifiedSearchResult {
  concerts: ConcertEvent[];
  facts: MemoryFact[];
  emails: Email[];
  reminders: Reminder[];
  watchLater: WatchLaterItem[];
  accreditations: Accreditation[];
}

const queryInput = z.string().max(200, "Requete trop longue");

export async function unifiedSearch(query: string): Promise<UnifiedSearchResult> {
  const { data } = await actionInput(queryInput, query);
  const q = data.toLowerCase().trim();
  if (!q) return { concerts: [], facts: [], emails: [], reminders: [], watchLater: [], accreditations: [] };

  const [concerts, memory, reminders, watchLater, accreditations] = await Promise.all([
    getConcerts(),
    getMemory(),
    getReminders(),
    getWatchLater(),
    getAccreditations(),
  ]);

  const filteredEmails = await searchEmails(query);

  return {
    concerts: concerts.events.filter(
      (c) =>
        c.artist.toLowerCase().includes(q) ||
        c.venue.toLowerCase().includes(q)
    ),
    facts: memory.facts.filter(
      (f) =>
        f.content.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
    ),
    emails: filteredEmails,
    reminders: reminders.reminders.filter(
      (r) =>
        r.title.toLowerCase().includes(q) ||
        (r.notes && r.notes.toLowerCase().includes(q))
    ),
    watchLater: watchLater.items.filter(
      (w) =>
        w.title.toLowerCase().includes(q) ||
        (w.description && w.description.toLowerCase().includes(q)) ||
        (w.aiTags && w.aiTags.some((t) => t.toLowerCase().includes(q)))
    ),
    accreditations: accreditations.accreditations.filter(
      (a) =>
        a.artist.toLowerCase().includes(q) ||
        a.venue.toLowerCase().includes(q) ||
        (a.notes && a.notes.toLowerCase().includes(q))
    ),
  };
}
