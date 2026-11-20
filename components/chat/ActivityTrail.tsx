"use client";

import { useState } from "react";
import { ChevronDown, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityStep } from "@/components/chat/types";
import { toolMeta } from "@/components/chat/chat-data";
import { normalizeToolName } from "@/lib/chat-tool-aliases";

// ── Fil d'activité ─────────────────────────────────────────────────────────
// Un seul fil par tour, au-dessus de la réponse : une ligne discrète repliée,
// un rail vertical quand on l'ouvre. Les pensées (reasoning du modèle) et les
// outils s'y succèdent dans l'ordre réel de la génération.

function truncate(text: string, max: number): string {
  return text.length <= max ? text : text.slice(0, max - 1).trimEnd() + "…";
}

function formatDuration(seconds: number): string {
  if (seconds < 1) return "< 1 s";
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds % 60);
  return `${minutes} min ${rest} s`;
}

// Résumé vivant : dernière phrase de la dernière pensée, sinon dernier outil.
function summarize(steps: ActivityStep[]): string | null {
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (step.kind === "thought") {
      const text = step.text.replace(/\s+/g, " ").trim();
      if (!text) continue;
      const sentence = text.split(/(?<=[.!?…])\s+/).pop() ?? text;
      return truncate(sentence, 92);
    }
    const label = toolMeta[normalizeToolName(step.name)]?.label ?? step.name;
    return step.status === "running" ? `${label}…` : label;
  }
  return null;
}

const ARG_KEYS: Record<string, string[]> = {
  web_search: ["query"],
  lookup_concerts: ["artist", "query"],
  fetch_and_search_emails: ["query"],
  search_calendar_events: ["query"],
  add_reminder: ["title"],
  update_reminder: ["title"],
  add_watch_later: ["title", "url"],
  add_memory_fact: ["content"],
  add_photo_shoot: ["title", "client"],
  get_weather: ["city", "location"],
  create_github_issue: ["title"],
  list_github_issues: ["state"],
};

function argSummary(step: Extract<ActivityStep, { kind: "tool" }>): string | null {
  if (!step.arguments) return null;
  try {
    const args = JSON.parse(step.arguments) as Record<string, unknown>;
    const keys = [...(ARG_KEYS[step.name] ?? []), ...Object.keys(args)];
    for (const key of keys) {
      const value = args[key];
      if (typeof value === "string" && value.trim()) {
        return value.replace(/\s+/g, " ").trim();
      }
    }
  } catch {
    return step.arguments.replace(/\s+/g, " ").trim();
  }
  return null;
}

function ActivityToolRow({ step }: { step: Extract<ActivityStep, { kind: "tool" }> }) {
  const [open, setOpen] = useState(false);
  const Icon = toolMeta[normalizeToolName(step.name)]?.icon ?? Sparkles;
  const label = toolMeta[normalizeToolName(step.name)]?.label ?? step.name;
  const unit = toolMeta[normalizeToolName(step.name)]?.unit ?? "résultats";
  const unitLabel =
    step.resultCount != null && step.resultCount <= 1 && unit.endsWith("s")
      ? unit.slice(0, -1)
      : unit;
  const arg = argSummary(step);
  const isRunning = step.status === "running";
  const isError = step.status === "error";

  const meta = [
    step.duration != null && !isRunning ? formatDuration(step.duration) : null,
    step.resultCount != null && !isRunning ? `${step.resultCount} ${unitLabel}` : null,
  ].filter(Boolean) as string[];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="-ml-1.5 flex w-[calc(100%+0.75rem)] items-center gap-2 rounded-[8px] px-1.5 py-1 text-left transition-colors duration-150 hover:bg-[var(--surface-2)]"
      >
        <Icon className="w-3 h-3 shrink-0 text-[var(--text-3)]" />
        <span className="ui-mono shrink-0 text-[12.5px] text-[var(--text-3)]">{label}</span>
        {arg && (
          <span className="ui-mono min-w-0 truncate text-[12px] text-[var(--text-4)]">{arg}</span>
        )}
        {meta.length > 0 && (
          <span
            className={cn(
              "ui-mono ml-auto shrink-0 text-[11.5px] text-[var(--text-4)]",
              isError && "text-[var(--danger)]"
            )}
          >
            {meta.join(" · ")}
          </span>
        )}
        <ChevronDown
          className={cn(
            "w-3 h-3 shrink-0 text-[var(--text-4)] transition-transform duration-150",
            open && "rotate-180"
          )}
        />
      </button>
      {open && (
        <pre className="mt-1 mb-1.5 whitespace-pre-wrap break-words rounded-[8px] bg-[var(--surface-1)] px-3 py-2 ui-mono text-[11.5px] leading-relaxed text-[var(--text-3)] max-h-64 overflow-y-auto">
          {isRunning
            ? step.arguments || "En cours…"
            : step.result || step.arguments || ""}
        </pre>
      )}
    </div>
  );
}

function ActivityThought({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="relative py-1">
      <span className="absolute -left-[13px] top-[10px] h-[3px] w-[3px] rounded-full bg-[var(--text-4)]" />
      <button
        onClick={() => setExpanded((v) => !v)}
        title={expanded ? "Replier" : "Développer"}
        className={cn(
          "block max-w-[52ch] text-left text-[13px] italic leading-[1.55] text-[var(--text-3)] transition-colors duration-150 hover:text-[var(--text-2)]",
          !expanded && "line-clamp-3"
        )}
      >
        {text}
      </button>
    </div>
  );
}

export function ActivityTrail({
  steps,
  running = false,
  pendingLabel,
  activityMs,
}: {
  steps: ActivityStep[];
  running?: boolean;
  pendingLabel?: string;
  activityMs?: number;
}) {
  const [open, setOpen] = useState(false);

  if (steps.length === 0 && !running) return null;

  const count = steps.length;
  const errorCount = steps.filter(
    (s) => s.kind === "tool" && s.status === "error"
  ).length;
  const summary = running ? summarize(steps) ?? pendingLabel ?? "Réflexion…" : null;
  const duration = activityMs != null ? formatDuration(activityMs / 1000) : null;

  const headline = running
    ? summary
    : `${count} étape${count > 1 ? "s" : ""}${duration ? ` · ${duration}` : ""}`;
  const meta = running
    ? count > 0
      ? `${count} étape${count > 1 ? "s" : ""}`
      : null
    : errorCount > 0
      ? `${errorCount} échec${errorCount > 1 ? "s" : ""}`
      : null;

  return (
    <div className="mb-3.5">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        disabled={steps.length === 0}
        className="-ml-1.5 flex h-[26px] w-[calc(100%+0.75rem)] items-center gap-2.5 rounded-[8px] px-1.5 text-left transition-colors duration-150 enabled:hover:bg-[var(--surface-2)] disabled:cursor-default"
      >
        <span className="grid w-3.5 shrink-0 place-items-center">
          {running ? (
            <span className="h-[5px] w-[5px] rounded-full bg-[var(--accent)] thinking-dot" />
          ) : (
            <span
              className={cn(
                "h-[6px] w-[6px] rounded-full border",
                errorCount > 0 ? "border-[var(--danger)]" : "border-[var(--success)]"
              )}
            />
          )}
        </span>
        <span
          className={cn(
            "ui-mono min-w-0 truncate text-[12.5px] text-[var(--text-3)]",
            running && "text-[var(--text-2)]"
          )}
        >
          {headline}
        </span>
        {meta && (
          <span
            className={cn(
              "ui-mono ml-auto shrink-0 pl-3 text-[11.5px] text-[var(--text-4)]",
              !running && errorCount > 0 && "text-[var(--danger)]"
            )}
          >
            {meta}
          </span>
        )}
        {steps.length > 0 && (
          <ChevronDown
            className={cn(
              "w-3 h-3 shrink-0 text-[var(--text-4)] opacity-60 transition-transform duration-150",
              open && "rotate-180",
              !meta && "ml-auto"
            )}
          />
        )}
      </button>

      {open && steps.length > 0 && (
        <div className="relative mt-1 pl-5">
          <span className="absolute bottom-1.5 left-[6px] top-1 w-px bg-[var(--line)]" />
          <div className="space-y-0.5">
            {steps.map((step, i) =>
              step.kind === "thought" ? (
                <ActivityThought key={`t-${i}`} text={step.text} />
              ) : (
                <ActivityToolRow key={step.id} step={step} />
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
