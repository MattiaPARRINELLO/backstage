"use client";

import { useState, useEffect, useRef } from "react";
import { X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import type { PhotoShoot } from "@/lib/types";
import { STATUS_FLOW, statusIndex, formatDate } from "./constants";

export type ShootEditableFields = {
  title: string;
  date: string;
  client: string;
  notes: string;
  galleryLink: string;
  photosSent: number;
};

export function DetailModal({
  shoot,
  onClose,
  onEdit,
  onDelete,
}: {
  shoot: PhotoShoot;
  onClose: () => void;
  onEdit: (updates: Partial<ShootEditableFields>) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState(shoot.title);
  const [editDate, setEditDate] = useState(shoot.date);
  const [editClient, setEditClient] = useState(shoot.client);
  const [editNotes, setEditNotes] = useState(shoot.notes ?? "");
  const [editGalleryLink, setEditGalleryLink] = useState(shoot.galleryLink ?? "");
  const [editPhotosSent, setEditPhotosSent] = useState(shoot.photosSent ?? 0);

  const dialogRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Accessibilité de la modale : focus initial, piège Tab, fermeture Esc et
  // restauration du focus à la fermeture. Monté une seule fois (les props
  // sont lues via refs pour ne pas re-déclencher l'effet à chaque rendu).
  useEffect(() => {
    const dialog = dialogRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const selector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

    const focusables = () =>
      Array.from(
        (dialog?.querySelectorAll<HTMLElement>(selector) ?? [])
      ).filter((el) => !el.hasAttribute("disabled"));

    const first = focusables()[0];
    if (first) {
      first.focus();
    } else {
      dialog?.focus();
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !dialog) return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setEditTitle(shoot.title);
    setEditDate(shoot.date);
    setEditClient(shoot.client);
    setEditNotes(shoot.notes ?? "");
    setEditGalleryLink(shoot.galleryLink ?? "");
    setEditPhotosSent(shoot.photosSent ?? 0);
    setEditing(false);
  }, [shoot]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSave = () => {
    const updates: Partial<ShootEditableFields> = {};
    if (editTitle.trim() && editTitle.trim() !== shoot.title) updates.title = editTitle.trim();
    if (editDate.trim() !== shoot.date) updates.date = editDate.trim();
    if (editClient.trim() && editClient.trim() !== shoot.client) updates.client = editClient.trim();
    if (editNotes.trim() !== (shoot.notes ?? "")) updates.notes = editNotes.trim() || "";
    if (editGalleryLink.trim() !== (shoot.galleryLink ?? "")) updates.galleryLink = editGalleryLink.trim();
    if (editPhotosSent !== (shoot.photosSent ?? 0)) updates.photosSent = editPhotosSent;
    if (Object.keys(updates).length > 0) onEdit(updates);
    setEditing(false);
  };

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={shoot.title}
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[var(--background)]/70 py-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="ui-card mx-4 my-auto flex max-h-[85vh] w-full max-w-lg flex-col shadow-[var(--shadow-float)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line)] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            <h2 className="truncate font-display text-[length:var(--t-lead)] font-semibold text-[var(--text-1)]">
              {shoot.title}
            </h2>
            <span className="ui-chip shrink-0">
              {STATUS_FLOW[statusIndex(shoot.status)].label}
            </span>
          </div>
          <button
            onClick={onClose}
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-[var(--text-3)] transition-colors hover:bg-[var(--surface-2)] hover:text-[var(--text-1)]"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-5">
          <dl className="flex flex-wrap items-baseline gap-x-6 gap-y-2">
            <div className="flex items-baseline gap-2">
              <dt className="ui-label">Date</dt>
              <dd className="ui-mono text-[var(--text-2)]">{formatDate(shoot.date)}</dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="ui-label">Client</dt>
              <dd className="ui-mono text-[var(--text-2)]">{shoot.client}</dd>
            </div>
          </dl>

          {shoot.status === "sent" && shoot.galleryLink && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--line)] pt-3 text-[var(--accent)]">
              <span className="ui-mono">{shoot.photosSent ?? "?"} photos envoyées</span>
              <a
                href={shoot.galleryLink}
                target="_blank"
                rel="noopener noreferrer"
                className="ui-mono inline-flex items-center gap-1 underline decoration-[var(--line-2)] underline-offset-4 hover:text-[var(--text-1)]"
              >
                Voir la galerie <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          )}

          {editing ? (
            <div className="space-y-3">
              <Input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                placeholder="Titre"
              />
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full sm:flex-1"
                />
                <Input
                  type="text"
                  value={editClient}
                  onChange={(e) => setEditClient(e.target.value)}
                  className="w-full sm:flex-1"
                  placeholder="Client"
                />
              </div>
              <Textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                rows={3}
                placeholder="Notes"
              />
              {shoot.status === "sent" && (
                <div className="space-y-3 pt-1">
                  <Input
                    type="url"
                    value={editGalleryLink}
                    onChange={(e) => setEditGalleryLink(e.target.value)}
                    placeholder="Lien galerie"
                  />
                  <Input
                    type="number"
                    value={editPhotosSent}
                    onChange={(e) => setEditPhotosSent(Number(e.target.value))}
                    min={0}
                    placeholder="Nombre de photos"
                  />
                </div>
              )}
              <div className="flex items-center justify-between pt-2">
                <button type="button" className="ui-btn ui-btn--text" onClick={() => setEditing(false)}>
                  Annuler
                </button>
                <button type="button" className="ui-btn ui-btn--primary" onClick={handleSave}>
                  Sauvegarder
                </button>
              </div>
            </div>
          ) : (
            <>
              {shoot.notes ? (
                <div className="border-t border-[var(--line)] pt-3">
                  <p className="whitespace-pre-wrap text-[var(--t-small)] leading-relaxed text-[var(--text-2)]">
                    {shoot.notes}
                  </p>
                </div>
              ) : (
                <p className="border-t border-[var(--line)] pt-3 text-[var(--t-small)] text-[var(--text-4)]">
                  Aucune note
                </p>
              )}
              <div className="flex items-center justify-between gap-3 pt-1">
                <Button variant="danger" size="md" onClick={onDelete}>
                  Supprimer
                </Button>
                <Button variant="primary" size="md" onClick={() => setEditing(true)}>
                  Éditer
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
