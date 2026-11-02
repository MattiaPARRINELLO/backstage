"use client";

import { Check, Trash2, Pencil, RotateCcw, Clock, CloudOff } from "lucide-react";
import type { Reminder } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatRelative, isOverdue } from "@/lib/date";
import { RECURRENCE_META } from "./timeline";

export function ReminderRow({
  reminder,
  msLinked,
  onToggle,
  onEdit,
  onDelete,
}: {
  reminder: Reminder;
  msLinked?: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const overdue = reminder.status === "pending" && isOverdue(reminder.dueAt);
  const done = reminder.status === "done";
  return (
    <li className="group flex items-start gap-3 py-4 transition-colors hover:bg-[var(--surface-2)]/40">
      <button
        onClick={onToggle}
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border-2 transition-colors duration-200",
          done
            ? "border-[var(--success)] bg-[var(--success)] text-[var(--background)]"
            : "border-[var(--line-2)] hover:border-[var(--accent)]"
        )}
        title={done ? "Marquer en attente" : "Marquer comme fait"}
        aria-label={done ? "Marquer en attente" : "Marquer comme fait"}
      >
        {done && <Check className="w-3 h-3" strokeWidth={3} />}
      </button>
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-[length:var(--t-body)] leading-snug",
            done ? "text-[var(--text-3)] line-through" : overdue ? "text-[var(--danger)]" : "text-[var(--text-1)]"
          )}
        >
          {reminder.title}
        </p>
        {reminder.notes && (
          <p className="mt-1 text-[length:var(--t-small)] leading-relaxed text-[var(--text-2)]">
            {reminder.notes}
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          <span
            className={cn(
              "ui-mono inline-flex items-center gap-1",
              overdue ? "text-[var(--danger)]" : "text-[var(--text-3)]"
            )}
          >
            <Clock className="w-3 h-3" strokeWidth={1.5} />
            {overdue ? "En retard" : formatRelative(reminder.dueAt)}
          </span>
          <span className="ui-mono hidden text-[var(--text-3)] sm:inline">
            {new Date(reminder.dueAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
          {reminder.recurrence && (
            <span className="ui-mono inline-flex items-center gap-1 text-[var(--text-3)]">
              <RotateCcw className="w-3 h-3" strokeWidth={1.5} />
              {RECURRENCE_META[reminder.recurrence].label}
            </span>
          )}
          {msLinked && reminder.status === "pending" && !reminder.microsoftTaskId && (
            <span
              className="ui-mono inline-flex items-center gap-1 text-[var(--text-3)]"
              title="Non synchronisé avec Microsoft To Do (sync échouée ou rappel créé avant la liaison)"
            >
              <CloudOff className="w-3 h-3" strokeWidth={1.5} />
              Non synchronisé
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <button
          onClick={onEdit}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--accent)]"
          title="Modifier"
          aria-label="Modifier le rappel"
        >
          <Pencil className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
        <button
          onClick={onDelete}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--danger)]"
          title="Supprimer"
          aria-label="Supprimer le rappel"
        >
          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.5} />
        </button>
      </div>
    </li>
  );
}
