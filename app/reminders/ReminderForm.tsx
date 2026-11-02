"use client";

import { useMemo, useState } from "react";
import { X, Check } from "lucide-react";
import type { Reminder, ReminderRecurrence } from "@/lib/types";
import { toLocalInputValue, fromLocalInputValue } from "@/lib/date";
import { RECURRENCE_META } from "./timeline";

export type ReminderFormInput = {
  title: string;
  notes?: string;
  dueAt: string;
  recurrence?: ReminderRecurrence;
};

export function ReminderForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial?: Reminder;
  onCancel: () => void;
  onSubmit: (input: ReminderFormInput) => void;
}) {
  const defaultDue = useMemo(() => {
    if (initial) return toLocalInputValue(initial.dueAt);
    const oneHourFromNow = new Date();
    oneHourFromNow.setHours(oneHourFromNow.getHours() + 1);
    return toLocalInputValue(oneHourFromNow.toISOString());
  }, [initial]);
  const [title, setTitle] = useState(initial?.title ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [dueAt, setDueAt] = useState(defaultDue);
  const [recurrence, setRecurrence] = useState<ReminderRecurrence | undefined>(initial?.recurrence);

  return (
    <div className="ui-card p-5">
      <p className="text-[length:var(--t-body)] font-medium text-[var(--text-1)]">
        {initial ? "Modifier le rappel" : "Nouveau rappel"}
      </p>
      <div className="mt-4 space-y-3">
        <label className="block">
          <span className="ui-label mb-1.5 block">Titre</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre du rappel"
            aria-label="Titre du rappel"
            className="ui-field w-full"
            autoFocus
          />
        </label>
        <label className="block">
          <span className="ui-label mb-1.5 block">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes (optionnel)"
            aria-label="Notes"
            rows={2}
            className="ui-field min-h-[72px] w-full resize-none items-start py-3"
          />
        </label>
        <label className="block">
          <span className="ui-label mb-1.5 block">Échéance</span>
          <input
            id="reminder-due"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className="ui-field ui-mono w-full"
          />
        </label>
        <div>
          <span className="ui-label mb-2 block">Récurrence</span>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Récurrence">
            <button
              type="button"
              onClick={() => setRecurrence(undefined)}
              className="ui-chip"
              data-active={!recurrence}
            >
              Aucune
            </button>
            {(Object.keys(RECURRENCE_META) as ReminderRecurrence[]).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRecurrence(r)}
                className="ui-chip"
                data-active={recurrence === r}
              >
                {RECURRENCE_META[r].label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-5 flex items-center justify-end gap-2">
        <button onClick={onCancel} className="ui-btn ui-btn--ghost">
          <X className="w-4 h-4" strokeWidth={1.5} />
          Annuler
        </button>
        <button
          onClick={() => onSubmit({ title, notes: notes || undefined, dueAt: fromLocalInputValue(dueAt), recurrence })}
          disabled={!title.trim() || !dueAt}
          className="ui-btn ui-btn--primary"
        >
          <Check className="w-4 h-4" strokeWidth={1.5} />
          {initial ? "Sauver" : "Créer"}
        </button>
      </div>
    </div>
  );
}
