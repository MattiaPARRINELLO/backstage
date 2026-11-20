"use client";

import { CalendarWidget } from "@/components/widgets/CalendarWidget";
import { GmailWidget } from "@/components/widgets/GmailWidget";
import type { ContextTool } from "@/lib/chat-context";
import { cn } from "@/lib/utils";
import { RunningToolsCard } from "./RunningToolsCard";
import {
  MemoryContextCard,
  ReminderContextCard,
  SearchContextCard,
  WatchContextCard,
} from "./ToolResultCard";

export function ContextualView({
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
