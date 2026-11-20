"use client";

import {
  Sparkles,
  Brain,
  Bookmark,
  Bell,
  Lightbulb,
} from "lucide-react";
import type { ContextTool } from "@/lib/chat-context";
import { cn } from "@/lib/utils";

export function ToolResultCard({
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

export function MemoryContextCard({ lastTool }: { lastTool: ContextTool | null }) {
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

export function ReminderContextCard({ lastTool }: { lastTool: ContextTool | null }) {
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

export function WatchContextCard({ lastTool }: { lastTool: ContextTool | null }) {
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

export function SearchContextCard({ lastTool }: { lastTool: ContextTool | null }) {
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
