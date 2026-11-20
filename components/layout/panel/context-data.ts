import {
  Sparkles,
  Mail,
  CalendarRange,
  Brain,
  Bookmark,
  Bell,
  Globe,
} from "lucide-react";
import type { ContextTool } from "@/lib/chat-context";

export type View = "flux" | "calendar" | "gmail" | "leetcode" | "photos" | `module:${string}`;

export const TOOL_CONTEXT_MAP: Record<
  string,
  "calendar" | "gmail" | "memory" | "reminder" | "watch" | "search"
> = {
  create_calendar_event: "calendar",
  search_calendar_events: "calendar",
  fetch_and_search_emails: "gmail",
  send_email_response: "gmail",
  triage_emails: "gmail",
  add_memory_fact: "memory",
  add_reminder: "reminder",
  add_watch_later: "watch",
  web_search: "search",
  fetch_page_meta: "search",
  lookup_concerts: "search",
};

export const CONTEXT_LABELS: Record<string, { title: string; icon: typeof Sparkles }> = {
  calendar: { title: "Calendrier", icon: CalendarRange },
  gmail: { title: "Boîte de réception", icon: Mail },
  memory: { title: "Mémoire", icon: Brain },
  reminder: { title: "Rappels", icon: Bell },
  watch: { title: "À voir", icon: Bookmark },
  search: { title: "Recherche", icon: Globe },
};

export const VIEWS: { id: View; label: string }[] = [
  { id: "flux", label: "Flux" },
  { id: "calendar", label: "Agenda" },
  { id: "gmail", label: "Inbox" },
  { id: "leetcode", label: "Code" },
  { id: "photos", label: "Photos" },
];

export function pickContextKey(tools: Record<string, ContextTool>): string | null {
  const running = Object.values(tools);
  if (running.length > 0) {
    const last = running[running.length - 1];
    return TOOL_CONTEXT_MAP[last.name] ?? null;
  }
  return null;
}
