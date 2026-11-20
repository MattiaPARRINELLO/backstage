"use server";

import { z } from "zod";

import { actionInput } from "@/lib/action";
import { addCalendarEvent, getCalendar, getEmails, searchEmails, webSearch } from "@/lib/storage";
import type { CalendarEvent, Email } from "@/lib/types";

const emptyInput = z.object({});
const queryInput = z.string().min(1, "Requete requise").max(200, "Requete trop longue");

const calendarEventInput = z.object({
  title: z.string().trim().min(1, "Titre requis"),
  date: z.string().trim().min(1, "Date requise"),
  venue: z.string().trim().optional(),
  type: z.enum(["concert", "meeting", "other"]),
});

export async function loadCalendar(): Promise<CalendarEvent[]> {
  await actionInput(emptyInput, {});
  return getCalendar();
}

export async function createCalendarEvent(event: Omit<CalendarEvent, "id">): Promise<CalendarEvent> {
  const { data } = await actionInput(calendarEventInput, event);
  return addCalendarEvent(data);
}

export async function loadEmails(): Promise<Email[]> {
  await actionInput(emptyInput, {});
  const data = await getEmails();
  return data.emails;
}

export async function findEmails(query: string): Promise<Email[]> {
  const { data } = await actionInput(queryInput, query);
  return searchEmails(data);
}

export async function searchWeb(query: string): Promise<string> {
  const { data } = await actionInput(queryInput, query);
  return webSearch(data);
}
