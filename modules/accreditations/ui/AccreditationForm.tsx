"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";

import type { Accreditation } from "../schema";
import type { AccreditationEditInput } from "./api";

/** Formulaire d'edition en place d'une fiche existante. */
export function AccreditationForm({
  accreditation,
  busy,
  onSubmit,
  onCancel,
}: {
  accreditation: Accreditation;
  busy: boolean;
  onSubmit: (input: AccreditationEditInput) => void;
  onCancel: () => void;
}) {
  const [artist, setArtist] = useState(accreditation.artist);
  const [venue, setVenue] = useState(accreditation.venue);
  const [concertDate, setConcertDate] = useState(accreditation.concertDate);
  const [contactEmail, setContactEmail] = useState(accreditation.contactEmail ?? "");
  const [notes, setNotes] = useState(accreditation.notes ?? "");
  const valid = artist.trim().length > 0 && venue.trim().length > 0;

  return (
    <form
      className="border-b border-[var(--line)] px-1 py-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid) return;
        onSubmit({
          id: accreditation.id,
          artist: artist.trim(),
          venue: venue.trim(),
          concertDate: concertDate.trim(),
          contactEmail: contactEmail.trim() ? contactEmail.trim() : undefined,
          notes: notes.trim() ? notes.trim() : undefined,
        });
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="ui-label">Artiste</span>
          <span className="ui-field mt-1">
            <input
              type="text"
              value={artist}
              onChange={(event) => setArtist(event.target.value)}
              className="min-w-0 flex-1 bg-transparent"
              required
            />
          </span>
        </label>
        <label className="block">
          <span className="ui-label">Lieu</span>
          <span className="ui-field mt-1">
            <input
              type="text"
              value={venue}
              onChange={(event) => setVenue(event.target.value)}
              className="min-w-0 flex-1 bg-transparent"
              required
            />
          </span>
        </label>
        <label className="block">
          <span className="ui-label">Date du concert</span>
          <span className="ui-field mt-1">
            <input
              type="text"
              value={concertDate}
              onChange={(event) => setConcertDate(event.target.value)}
              placeholder="2026-12-05"
              className="min-w-0 flex-1 bg-transparent"
            />
          </span>
        </label>
        <label className="block">
          <span className="ui-label">Contact</span>
          <span className="ui-field mt-1">
            <input
              type="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              placeholder="presse@salle.fr"
              className="min-w-0 flex-1 bg-transparent"
            />
          </span>
        </label>
      </div>
      <label className="mt-3 block">
        <span className="ui-label">Notes</span>
        <span className="ui-field ui-field--area mt-1">
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={2}
            className="min-w-0 flex-1 resize-y bg-transparent"
          />
        </span>
      </label>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="submit"
          className="ui-btn ui-btn--primary ui-btn--sm"
          disabled={!valid || busy}
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
          Enregistrer
        </button>
        <button
          type="button"
          className="ui-btn ui-btn--quiet ui-btn--sm"
          disabled={busy}
          onClick={onCancel}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Annuler
        </button>
      </div>
    </form>
  );
}
