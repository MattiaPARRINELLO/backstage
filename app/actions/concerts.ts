"use server";

import { z } from "zod";

import { actionInput } from "@/lib/action";
import { getConcerts, saveConcerts, logActivity } from "@/lib/storage";
import type { ConcertsData, ConcertEvent } from "@/lib/types";

const emptyInput = z.object({});

const eventsInput = z
  .array(
    z.object({
      id: z.string().min(1),
      artist: z.string(),
      venue: z.string(),
      date: z.string(),
      status: z.enum(["shooted", "selecting", "editing", "delivered"]),
    })
  )
  .max(2000, "Trop d'evenements en une fois");

export async function loadConcerts(): Promise<ConcertsData> {
  await actionInput(emptyInput, {});
  return getConcerts();
}

export async function saveConcertEvents(events: ConcertEvent[]): Promise<void> {
  const { data } = await actionInput(eventsInput, events);
  await saveConcerts({ events: data });
  await logActivity("concert_updated", `Concerts mis à jour (${data.length} événements)`);
}
