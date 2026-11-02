"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

export function AddShootForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (title: string, date: string, client: string, notes?: string) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [client, setClient] = useState("");
  const [notes, setNotes] = useState("");

  const valid = Boolean(title.trim() && date.trim() && client.trim());

  const handleSubmit = () => {
    if (!valid) return;
    onSubmit(title.trim(), date.trim(), client.trim(), notes.trim() || undefined);
  };

  return (
    <form
      className="ui-card max-w-2xl space-y-3 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
    >
      <h3 className="font-display text-[length:var(--t-lead)] font-semibold text-[var(--text-1)]">
        Nouveau shooting
      </h3>

      <div className="ui-field">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titre du shooting"
          autoFocus
          className="min-w-0 flex-1 bg-transparent text-base outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="ui-field">
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            aria-label="Date du shooting"
            className="min-w-0 flex-1 bg-transparent text-base outline-none"
          />
        </div>
        <div className="ui-field">
          <input
            type="text"
            value={client}
            onChange={(e) => setClient(e.target.value)}
            placeholder="Client"
            aria-label="Client"
            className="min-w-0 flex-1 bg-transparent text-base outline-none"
          />
        </div>
      </div>

      <div className="ui-field">
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notes (optionnel)"
          aria-label="Notes"
          className="min-w-0 flex-1 bg-transparent text-base outline-none"
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <button type="button" className="ui-btn ui-btn--ghost" onClick={onCancel}>
          Annuler
        </button>
        <button type="submit" className="ui-btn ui-btn--primary gap-2" disabled={!valid}>
          <Plus className="h-4 w-4" aria-hidden />
          Ajouter
        </button>
      </div>
    </form>
  );
}
