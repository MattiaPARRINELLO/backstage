"use client";

import { useEffect, useState } from "react";
import { normalizeToolName } from "@/lib/chat-tool-aliases";
import type { ContextTool } from "@/lib/chat-context";
import {
  Sparkles,
  Loader2,
  Mail,
  CalendarRange,
  Brain,
  Bookmark,
  Bell,
  Globe,
  SendHorizontal,
  CalendarPlus,
  Inbox,
  ListChecks,
  CircleDot,
} from "lucide-react";

export function RunningToolsCard({ tools }: { tools: ContextTool[] }) {
  return (
    <div className="ui-tile p-3 space-y-2">
      <div className="flex items-center gap-2 ui-mono text-[var(--accent)]">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Outils en cours</span>
      </div>
      <ul className="divide-y divide-[var(--line)]">
        {tools.map((t) => {
          const meta = TOOL_LABELS[normalizeToolName(t.name)];
          const Icon = meta?.icon ?? Sparkles;
          return (
            <li
              key={t.id}
              className="flex items-center gap-2 py-2"
            >
              <Icon className="w-3 h-3 text-[var(--accent)]" />
              <span className="text-[length:var(--t-small)] text-[var(--text-1)] truncate">{meta?.label ?? t.name}</span>
              <ToolDuration startedAt={t.startedAt} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ToolDuration({ startedAt }: { startedAt: number }) {
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 200);
    return () => clearInterval(id);
  }, [startedAt]);
  return (
    <span className="ml-auto ui-mono text-[var(--text-4)]">
      {(elapsed / 1000).toFixed(1)}s
    </span>
  );
}

const TOOL_LABELS: Record<string, { label: string; icon: typeof Sparkles }> = {
  web_search: { label: "Recherche web", icon: Globe },
  fetch_and_search_emails: { label: "Consultation Gmail", icon: Mail },
  send_email_response: { label: "Envoi email", icon: SendHorizontal },
  create_calendar_event: { label: "Création événement", icon: CalendarPlus },
  add_memory_fact: { label: "Mémorisation", icon: Brain },
  "reminders.add": { label: "Nouveau rappel", icon: Bell },
  "schedule.get": { label: "Emploi du temps", icon: CalendarRange },
  "reminders.list": { label: "Rappels", icon: Bell },
  "reminders.update": { label: "Rappel", icon: Bell },
  add_watch_later: { label: "Ajout à la liste", icon: Bookmark },
  search_calendar_events: { label: "Recherche agenda", icon: CalendarRange },
  lookup_concerts: { label: "Concerts", icon: Globe },
  triage_emails: { label: "Tri emails", icon: ListChecks },
  fetch_page_meta: { label: "Aperçu lien", icon: Inbox },
  create_github_issue: { label: "Issue GitHub", icon: CircleDot },
  list_github_issues: { label: "Issues GitHub", icon: CircleDot },
};
