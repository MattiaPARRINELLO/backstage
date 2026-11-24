"use client";

import { useState } from "react";
import { CalendarDays, Check, Mail, MapPin, Pencil, Trash2 } from "lucide-react";
import { useModuleToasts } from "@backstage/module-kit";

import type { Accreditation, AccreditationStatus } from "../schema";
import type { AccreditationEditInput } from "./api";
import { AccreditationForm } from "./AccreditationForm";
import { STATUS_META, STATUS_ORDER, formatConcertDate } from "./meta";

function formatFollowUp(value: string): string {
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return value;
  return new Date(time).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
  });
}

interface Props {
  accreditation: Accreditation;
  onStatus: (status: AccreditationStatus) => Promise<void>;
  /** Rend `false` quand l'enregistrement a echoue : l'edition reste ouverte. */
  onSave: (input: AccreditationEditInput) => Promise<boolean>;
  onDelete: () => Promise<void>;
}

/** Une fiche : lecture, changement de statut, édition en place, suppression. */
export function AccreditationRow({ accreditation, onStatus, onSave, onDelete }: Props) {
  const [editing, setEditing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useModuleToasts();
  const meta = STATUS_META[accreditation.status];

  async function run(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }

  async function copyFollowUpDraft() {
    try {
      await navigator.clipboard.writeText(accreditation.followUpDraft ?? "");
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (cause) {
      // Hors contexte securise le presse-papiers est indisponible. Le texte
      // reste affiche dans la fiche pour une selection manuelle.
      console.warn("[accreditations] copie du texte de relance impossible:", cause);
      toast?.show({ message: "Copier impossible", tone: "danger" });
    }
  }

  if (editing) {
    return (
      <AccreditationForm
        accreditation={accreditation}
        busy={busy}
        onCancel={() => setEditing(false)}
        onSubmit={(input) =>
          run(async () => {
            const saved = await onSave(input);
            if (saved) setEditing(false);
          })
        }
      />
    );
  }

  return (
    <article className="flex flex-col gap-3 border-b border-[var(--line)] px-1 py-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <h3 className="min-w-0 truncate text-[length:var(--t-body)] font-medium text-[var(--text-1)]">
            {accreditation.artist}
          </h3>
          {accreditation.needsReview && (
            <span
              className="ui-chip shrink-0 text-[var(--warning)]"
              title="Extraction incertaine a confirmer"
            >
              À vérifier
            </span>
          )}
        </div>
        <p className="ui-mono mt-1 flex flex-wrap items-center gap-2 text-[var(--text-3)]">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3" aria-hidden />
            {accreditation.venue}
          </span>
          <span aria-hidden>·</span>
          <span className="flex items-center gap-1">
            <CalendarDays className="h-3 w-3" aria-hidden />
            {formatConcertDate(accreditation.concertDate)}
          </span>
          {accreditation.contactEmail && (
            <>
              <span aria-hidden>·</span>
              <span className="flex min-w-0 items-center gap-1">
                <Mail className="h-3 w-3" aria-hidden />
                <span className="truncate">{accreditation.contactEmail}</span>
              </span>
            </>
          )}
        </p>
        {accreditation.notes && (
          <p className="mt-1 line-clamp-2 text-[length:var(--t-small)] text-[var(--text-3)]">
            {accreditation.notes}
          </p>
        )}
        {accreditation.followUpDraft ? (
          <details className="mt-2">
            <summary className="ui-mono cursor-pointer text-[var(--warning)]">
              Relance prête, envoi manuel
            </summary>
            <p className="mt-2 whitespace-pre-line text-[length:var(--t-small)] leading-relaxed text-[var(--text-2)]">
              {accreditation.followUpDraft}
            </p>
            <button
              type="button"
              className="ui-btn ui-btn--ghost ui-btn--xs mt-2"
              onClick={() => void copyFollowUpDraft()}
            >
              {copied ? "Copié" : "Copier le texte"}
            </button>
          </details>
        ) : accreditation.followUpAt ? (
          <p className="ui-mono mt-1 text-[var(--text-4)]">
            Relance prévue le {formatFollowUp(accreditation.followUpAt)}
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span className="ui-field ui-field--boxed px-2 py-1">
          <select
            aria-label={`Statut de ${accreditation.artist}`}
            className={`min-w-0 bg-transparent text-[length:var(--t-small)] font-medium ${meta.toneClass}`}
            value={accreditation.status}
            disabled={busy}
            onChange={(event) =>
              run(() => onStatus(event.target.value as AccreditationStatus))
            }
          >
            {STATUS_ORDER.map((status) => (
              <option key={status} value={status}>
                {STATUS_META[status].label}
              </option>
            ))}
          </select>
        </span>
        <button
          type="button"
          className="ui-btn ui-btn--quiet ui-btn--icon ui-btn--sm"
          title="Modifier"
          aria-label={`Modifier ${accreditation.artist}`}
          disabled={busy}
          onClick={() => setEditing(true)}
        >
          <Pencil className="h-3.5 w-3.5" aria-hidden />
        </button>
        {confirming ? (
          <>
            <button
              type="button"
              className="ui-btn ui-btn--danger ui-btn--sm"
              disabled={busy}
              onClick={() => run(onDelete)}
            >
              <Check className="h-3.5 w-3.5" aria-hidden />
              Supprimer
            </button>
            <button
              type="button"
              className="ui-btn ui-btn--quiet ui-btn--sm"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Annuler
            </button>
          </>
        ) : (
          <button
            type="button"
            className="ui-btn ui-btn--quiet ui-btn--icon ui-btn--sm"
            title="Supprimer"
            aria-label={`Supprimer ${accreditation.artist}`}
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </div>
    </article>
  );
}
