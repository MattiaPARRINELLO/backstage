"use client";

// ============================================================
// Modale de creation et d'edition d'un evenement.
// Aucun etat propre : le parent porte le formulaire et la sauvegarde.
// ============================================================

import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatTime } from "@/lib/date";
import type { CalendarEvent } from "@/lib/api-client";
import { EVENT_COLORS, isAllDay, toDatetimeLocal } from "./calendar-utils";

export type EditForm = {
  summary: string;
  description: string;
  location: string;
  colorId: string;
};

type Props = {
  editing: CalendarEvent;
  isCreating: boolean;
  editForm: EditForm;
  saving: boolean;
  setEditForm: React.Dispatch<React.SetStateAction<EditForm>>;
  setEditing: React.Dispatch<React.SetStateAction<CalendarEvent | null>>;
  onSave: () => void;
};

export function EventEditor({
  editing,
  isCreating,
  editForm,
  saving,
  setEditForm,
  setEditing,
  onSave,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[var(--background)]/70 py-4 backdrop-blur-sm sm:items-center">
      <div className="ui-card my-auto mx-4 flex max-h-[85vh] w-full max-w-lg flex-col shadow-[var(--shadow-float)]">
        <div className="flex shrink-0 items-center justify-between border-b border-[var(--line)] px-6 py-4">
          <h3 className="font-display text-[length:var(--t-lead)] font-semibold tracking-[-0.03em] text-[var(--text-1)]">
            {isCreating ? "Nouvel événement" : "Modifier l'événement"}
          </h3>
          <button
            onClick={() => setEditing(null)}
            className="-mr-2 flex h-9 w-9 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
            aria-label="Fermer"
          >
            <X className="w-4 h-4" strokeWidth={1.5} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-6">
          <label className="block">
            <span className="ui-label mb-1.5 block">Titre</span>
            <input
              type="text"
              className="ui-field w-full"
              value={editForm.summary}
              onChange={(e) => setEditForm((f) => ({ ...f, summary: e.target.value }))}
              placeholder="Titre de l'événement"
            />
          </label>

          {isCreating && (
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="ui-label mb-1.5 block">Début</span>
                <input
                  type="datetime-local"
                  className="ui-field ui-mono w-full"
                  value={toDatetimeLocal(editing.start)}
                  onChange={(e) => setEditing((evt) => (evt ? { ...evt, start: new Date(e.target.value).toISOString() } : null))}
                />
              </label>
              <label className="block">
                <span className="ui-label mb-1.5 block">Fin</span>
                <input
                  type="datetime-local"
                  className="ui-field ui-mono w-full"
                  value={toDatetimeLocal(editing.end)}
                  onChange={(e) => setEditing((evt) => (evt ? { ...evt, end: new Date(e.target.value).toISOString() } : null))}
                />
              </label>
            </div>
          )}

          <label className="block">
            <span className="ui-label mb-1.5 block">Lieu</span>
            <input
              type="text"
              className="ui-field w-full"
              value={editForm.location}
              onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
              placeholder="Salle, lien, adresse…"
            />
          </label>

          <label className="block">
            <span className="ui-label mb-1.5 block">Description</span>
            <textarea
              className="ui-field min-h-[88px] w-full resize-none items-start py-3"
              value={editForm.description}
              onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
            />
          </label>

          <div>
            <span className="ui-label mb-2 block">Couleur</span>
            <div className="flex flex-wrap gap-2">
              {Object.entries(EVENT_COLORS).map(([id, c]) => (
                <button
                  key={id}
                  onClick={() => setEditForm((f) => ({ ...f, colorId: id }))}
                  title={c.name}
                  aria-label={c.name}
                  aria-pressed={editForm.colorId === id}
                  className={cn(
                    "h-8 w-8 rounded-full border-2 transition-colors duration-200",
                    editForm.colorId === id
                      ? "border-[var(--text-1)]"
                      : "border-transparent hover:border-[var(--line-2)]"
                  )}
                  style={{ backgroundColor: c.bg }}
                />
              ))}
              <button
                onClick={() => setEditForm((f) => ({ ...f, colorId: "" }))}
                title="Aucune couleur"
                aria-label="Aucune couleur"
                aria-pressed={!editForm.colorId}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-[var(--text-3)] transition-colors duration-200",
                  !editForm.colorId
                    ? "border-[var(--text-1)]"
                    : "border-dashed border-[var(--line-2)] hover:border-[var(--text-3)]"
                )}
              >
                <X className="w-3 h-3" strokeWidth={1.5} />
              </button>
            </div>
          </div>

          {editing.start && (
            <div className="ui-mono flex flex-wrap items-center gap-2 border-t border-[var(--line)] pt-4 text-[var(--text-3)]">
              <span>{new Date(editing.start).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}</span>
              {!isAllDay(editing) && (
                <span>{formatTime(editing.start)} — {formatTime(editing.end)}</span>
              )}
              {isAllDay(editing) && <span>Journée entière</span>}
            </div>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-[var(--line)] px-6 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            onClick={() => setEditing(null)}
            className="ui-btn ui-btn--ghost"
          >
            Annuler
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="ui-btn ui-btn--primary"
          >
            {saving ? "Enregistrement…" : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}
