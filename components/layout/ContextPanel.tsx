"use client";

import { useState, useEffect } from "react";
import {
  Settings2,
  X,
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
  Lightbulb,
} from "lucide-react";
import { CalendarWidget } from "@/components/widgets/CalendarWidget";
import { GmailWidget } from "@/components/widgets/GmailWidget";
import { LeetCodeWidget } from "@/components/widgets/LeetCodeWidget";
import { AccreditationsWidget } from "@/components/widgets/AccreditationsWidget";
import { FluxTimeline } from "@/components/layout/FluxTimeline";
import { useChatContext, type ContextTool } from "@/lib/chat-context";
import { useNow } from "@/lib/clock";
import { formatTime } from "@/lib/date";
import { cn } from "@/lib/utils";

type View = "flux" | "calendar" | "gmail" | "leetcode" | "photos";

const TOOL_CONTEXT_MAP: Record<string, "calendar" | "gmail" | "memory" | "reminder" | "watch" | "search"> = {
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

const CONTEXT_LABELS: Record<string, { title: string; icon: typeof Sparkles }> = {
  calendar: { title: "Calendrier", icon: CalendarRange },
  gmail: { title: "Boîte de réception", icon: Mail },
  memory: { title: "Mémoire", icon: Brain },
  reminder: { title: "Rappels", icon: Bell },
  watch: { title: "À voir", icon: Bookmark },
  search: { title: "Recherche", icon: Globe },
};

const VIEWS: { id: View; label: string }[] = [
  { id: "flux", label: "Flux" },
  { id: "calendar", label: "Agenda" },
  { id: "gmail", label: "Inbox" },
  { id: "leetcode", label: "Code" },
  { id: "photos", label: "Photos" },
];

function pickContextKey(tools: Record<string, ContextTool>): string | null {
  const running = Object.values(tools);
  if (running.length > 0) {
    const last = running[running.length - 1];
    return TOOL_CONTEXT_MAP[last.name] ?? null;
  }
  return null;
}

export function ContextPanel() {
  const [view, setView] = useState<View>("flux");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const chatCtx = useChatContext();
  const now = useNow();

  const contextKey = pickContextKey(chatCtx.activeTools);
  const lastTool = chatCtx.lastFinishedTool;
  const lastToolKey = lastTool ? TOOL_CONTEXT_MAP[lastTool.name] ?? null : null;
  const activeContext = contextKey ?? lastToolKey;
  const busy = Object.values(chatCtx.activeTools).length > 0;

  return (
    <>
      {chatCtx.busy && (
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="xl:hidden fixed bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] right-3 z-30 w-11 h-11 rounded-full bg-[var(--accent)] text-[var(--background)] shadow-[var(--shadow-float)] flex items-center justify-center"
          aria-label="Ouvrir le contexte"
        >
          <Sparkles className="w-4 h-4 animate-pulse" />
        </button>
      )}

      <aside
        aria-label="Panneau de contexte"
        className={cn(
          "flex flex-col shrink-0 my-3 mr-3 overflow-hidden bg-[var(--surface-1)] border border-[var(--line)] rounded-[var(--r-card)] transition-[width,transform] duration-300 ease-out",
          "xl:relative xl:translate-x-0",
          collapsed ? "xl:w-14" : "xl:w-[340px]",
          mobileOpen
            ? "fixed inset-x-0 bottom-0 top-auto z-40 w-full my-0 mr-0 rounded-b-none rounded-t-[var(--r-card)] pb-[env(safe-area-inset-bottom)]"
            : "hidden xl:flex",
          mobileOpen && "max-h-[82vh]"
        )}
      >
        <header className="shrink-0">
          <div className="flex items-center gap-2 h-12 px-4">
            <span className="ui-mono text-[var(--text-3)]">
              {activeContext ? CONTEXT_LABELS[activeContext]?.title ?? "Contexte" : "Panneau"}
            </span>
            {now > 0 && (
              <span className="ui-mono text-[var(--text-4)]">
                {formatTime(new Date(now).toISOString())}
              </span>
            )}
            <button
              onClick={() => {
                if (mobileOpen) {
                  setMobileOpen(false);
                } else {
                  setCollapsed((c) => !c);
                }
              }}
              className="ml-auto w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--surface-2)] transition-colors"
              title={mobileOpen ? "Fermer" : collapsed ? "Étendre" : "Réduire"}
              aria-label={mobileOpen ? "Fermer le panneau" : collapsed ? "Étendre le panneau" : "Réduire le panneau"}
            >
              {mobileOpen ? (
                <X className="w-3.5 h-3.5" />
              ) : collapsed ? (
                <Settings2 className="w-3.5 h-3.5" />
              ) : (
                <X className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {!collapsed && (
            <div className="px-4 pb-3">
              {activeContext ? (
                <ContextBadge contextKey={activeContext} running={busy} />
              ) : (
                <ViewSwitcher view={view} onChange={setView} />
              )}
            </div>
          )}
        </header>

        {!collapsed && (
          <div className="flex-1 overflow-y-auto overscroll-contain px-4 pb-4 space-y-4 context-panel-body">
            {activeContext ? (
              <ContextualView
                contextKey={activeContext}
                runningTools={Object.values(chatCtx.activeTools)}
                lastTool={lastTool}
                onDismissLast={() => chatCtx.dismissLastFinishedTool()}
              />
            ) : view === "flux" ? (
              <div key="flux" className="flux-enter space-y-4">
                <FluxTimeline />
                <div className="pt-1 space-y-3">
                  <GmailWidget />
                  <LeetCodeWidget />
                  <AccreditationsWidget />
                </div>
              </div>
            ) : (
              <div key={view} className="flux-enter space-y-3">
                {view === "calendar" && <CalendarWidget />}
                {view === "gmail" && <GmailWidget />}
                {view === "leetcode" && <LeetCodeWidget />}
                {view === "photos" && <AccreditationsWidget />}
              </div>
            )}
          </div>
        )}
      </aside>
    </>
  );
}

function ContextBadge({ contextKey, running }: { contextKey: string; running: boolean }) {
  const meta = CONTEXT_LABELS[contextKey];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[var(--accent)]/10">
      <Icon className={cn("w-3 h-3 text-[var(--accent)]", running && "animate-pulse")} />
      <span className="ui-mono text-[var(--accent)]">
        {meta.title}
      </span>
    </div>
  );
}

function ViewSwitcher({ view, onChange }: { view: View; onChange: (v: View) => void }) {
  return (
    <div
      role="tablist"
      aria-label="Vues du panneau"
      className="flex flex-wrap items-center gap-1.5"
    >
      {VIEWS.map((t) => {
        const active = view === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={active}
            data-active={active}
            onClick={() => onChange(t.id)}
            className="ui-chip transition-colors duration-150"
          >
            <span className="block truncate">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ContextualView({
  contextKey,
  runningTools,
  lastTool,
  onDismissLast,
}: {
  contextKey: string;
  runningTools: ContextTool[];
  lastTool: ContextTool | null;
  onDismissLast: () => void;
}) {
  return (
    <div className="context-view-enter space-y-3">
      {runningTools.length > 0 && <RunningToolsCard tools={runningTools} />}
      {contextKey === "calendar" && (
        <div className={cn(runningTools.length > 0 && "context-pulse")}>
          <CalendarWidget />
        </div>
      )}
      {contextKey === "gmail" && <GmailWidget />}
      {contextKey === "memory" && <MemoryContextCard lastTool={lastTool} />}
      {contextKey === "reminder" && <ReminderContextCard lastTool={lastTool} />}
      {contextKey === "watch" && <WatchContextCard lastTool={lastTool} />}
      {contextKey === "search" && <SearchContextCard lastTool={lastTool} />}

      {lastTool && runningTools.length === 0 && (
        <div className="flex items-center gap-3 pt-1">
          <span className="ui-mono text-[var(--text-4)]">
            Dernier résultat
          </span>
          <span className="flex-1 h-px bg-[var(--line)]" />
          <button
            onClick={onDismissLast}
            className="ui-mono text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors duration-150"
          >
            Réinitialiser
          </button>
        </div>
      )}
    </div>
  );
}

function RunningToolsCard({ tools }: { tools: ContextTool[] }) {
  return (
    <div className="ui-tile p-3 space-y-2">
      <div className="flex items-center gap-2 ui-mono text-[var(--accent)]">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span>Outils en cours</span>
      </div>
      <ul className="divide-y divide-[var(--line)]">
        {tools.map((t) => {
          const meta = TOOL_LABELS[t.name];
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
  add_reminder: { label: "Nouveau rappel", icon: Bell },
  add_watch_later: { label: "Ajout à la liste", icon: Bookmark },
  search_calendar_events: { label: "Recherche agenda", icon: CalendarRange },
  lookup_concerts: { label: "Concerts", icon: Globe },
  triage_emails: { label: "Tri emails", icon: ListChecks },
  fetch_page_meta: { label: "Aperçu lien", icon: Inbox },
};

function ToolResultCard({
  icon,
  iconClass,
  title,
  empty,
  result,
  clamp,
}: {
  icon: typeof Sparkles;
  iconClass: string;
  title: string;
  empty: string;
  result?: string;
  clamp?: boolean;
}) {
  const Icon = icon;
  return (
    <div className="ui-tile p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Icon className={cn("w-3.5 h-3.5", iconClass)} />
        <span className="ui-mono text-[var(--text-3)]">
          {title}
        </span>
      </div>
      <p
        className={cn(
          "text-[length:var(--t-small)] leading-relaxed whitespace-pre-wrap",
          result ? "text-[var(--text-1)]" : "text-[var(--text-3)]",
          result && clamp && "line-clamp-8"
        )}
      >
        {result || empty}
      </p>
    </div>
  );
}

function MemoryContextCard({ lastTool }: { lastTool: ContextTool | null }) {
  return (
    <ToolResultCard
      icon={Brain}
      iconClass="text-[var(--accent)]"
      title="Faits utilisés"
      empty="L'IA puise dans ta mémoire longue pour contextualiser ses réponses."
      result={lastTool?.result}
    />
  );
}

function ReminderContextCard({ lastTool }: { lastTool: ContextTool | null }) {
  return (
    <ToolResultCard
      icon={Bell}
      iconClass="text-[var(--accent)]"
      title="Rappel créé"
      empty="L'IA ajoute un rappel à ton agenda."
      result={lastTool?.result}
    />
  );
}

function WatchContextCard({ lastTool }: { lastTool: ContextTool | null }) {
  return (
    <ToolResultCard
      icon={Bookmark}
      iconClass="text-[var(--accent)]"
      title="Ajouté à la liste"
      empty="L'IA classe un lien pour plus tard."
      result={lastTool?.result}
    />
  );
}

function SearchContextCard({ lastTool }: { lastTool: ContextTool | null }) {
  return (
    <ToolResultCard
      icon={Lightbulb}
      iconClass="text-[var(--accent)]"
      title="Résultats de recherche"
      empty="L'IA parcourt le web pour toi."
      result={lastTool?.result}
      clamp
    />
  );
}
