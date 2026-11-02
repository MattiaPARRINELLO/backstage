"use client";

import { useState, useEffect } from "react";
import { X, ExternalLink, ArrowRight, Camera } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { IconButton } from "@/components/ui/IconButton";
import type { PhotoShoot, PhotoShootStatus } from "@/lib/types";
import { STATUS_FLOW, STATUS_ORDER, statusIndex, thumbParts } from "./constants";

export function ShootCard({
  shoot,
  onStatusChange,
  onDelete,
  onUpdateSent,
  onDetail,
}: {
  shoot: PhotoShoot;
  onStatusChange: (status: PhotoShootStatus) => void;
  onDelete: () => void;
  onUpdateSent: (galleryLink: string, photosSent: number) => void;
  onDetail: () => void;
}) {
  const [sentLink, setSentLink] = useState(shoot.galleryLink ?? "");
  const [sentCount, setSentCount] = useState(shoot.photosSent ?? 0);
  const [showSentForm, setShowSentForm] = useState(false);

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setSentLink(shoot.galleryLink ?? "");
    setSentCount(shoot.photosSent ?? 0);
  }, [shoot]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const nextStatus: PhotoShootStatus | null = (() => {
    const idx = statusIndex(shoot.status);
    return idx < STATUS_ORDER.length - 1 ? STATUS_ORDER[idx + 1] : null;
  })();

  const thumb = thumbParts(shoot.date);

  const handleSend = () => {
    if (sentLink.trim()) {
      onUpdateSent(sentLink.trim(), sentCount);
      setShowSentForm(false);
    }
  };

  const sentFields = (
    <div className="space-y-2">
      <div className="ui-field">
        <input
          type="url"
          value={sentLink}
          onChange={(e) => setSentLink(e.target.value)}
          placeholder="Lien galerie"
          className="min-w-0 flex-1 bg-transparent text-base outline-none"
        />
      </div>
      <div className="flex items-center gap-2">
        <div className="ui-field w-24">
          <input
            type="number"
            value={sentCount}
            onChange={(e) => setSentCount(Number(e.target.value))}
            min={0}
            placeholder="Photos"
            className="min-w-0 flex-1 bg-transparent text-base outline-none"
          />
        </div>
        <Button variant="primary" size="sm" onClick={handleSend} disabled={!sentLink.trim()}>
          {shoot.galleryLink ? "Mettre à jour" : "Valider"}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="ui-tile group cursor-grab overflow-hidden transition-colors hover:border-[var(--line-2)] active:cursor-grabbing">
      <div className="flex items-start gap-3 p-3" onClick={onDetail}>
        <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[var(--r-sm)] bg-[var(--surface-2)] text-[var(--text-3)]">
          {thumb ? (
            <>
              <span className="font-display text-[length:var(--t-body)] font-semibold leading-none text-[var(--text-1)]">
                {thumb.day}
              </span>
              <span className="ui-mono leading-none">{thumb.month}</span>
            </>
          ) : (
            <Camera className="h-4 w-4" strokeWidth={1.6} aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h4 className="truncate text-[length:var(--t-body)] font-medium text-[var(--text-1)]">
            {shoot.title}
          </h4>
          <p className="ui-mono truncate text-[var(--text-3)]">{shoot.client}</p>

          {shoot.status === "sent" && shoot.galleryLink && (
            <div className="mt-1.5 flex items-center gap-2 text-[var(--accent)]">
              <span className="ui-mono">{shoot.photosSent ?? "?"} photos</span>
              <a
                href={shoot.galleryLink}
                target="_blank"
                rel="noopener noreferrer"
                className="ui-mono inline-flex items-center gap-1 underline decoration-[var(--line-2)] underline-offset-4 hover:text-[var(--text-1)]"
                onClick={(e) => e.stopPropagation()}
              >
                Galerie <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {shoot.notes && (
            <p className="mt-1.5 line-clamp-2 text-[var(--t-small)] leading-relaxed text-[var(--text-3)]">
              {shoot.notes}
            </p>
          )}
        </div>
      </div>

      {shoot.status === "sent" && (
        <div className="px-3 pb-3" onClick={(e) => e.stopPropagation()}>
          {sentFields}
        </div>
      )}

      {showSentForm && shoot.status !== "sent" && (
        <div className="px-3 pb-3" onClick={(e) => e.stopPropagation()}>
          {sentFields}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 px-3 pb-2.5 pt-1">
        {nextStatus ? (
          <button
            type="button"
            className="ui-btn ui-btn--text gap-1"
            onClick={(e) => {
              e.stopPropagation();
              if (nextStatus === "sent") {
                setShowSentForm(true);
              } else {
                onStatusChange(nextStatus);
              }
            }}
          >
            {STATUS_FLOW.find((s) => s.key === nextStatus)?.label}
            <ArrowRight className="h-3 w-3" aria-hidden />
          </button>
        ) : (
          <span className="ui-mono text-[var(--text-4)]">Livré</span>
        )}
        <IconButton
          label="Supprimer"
          size="xs"
          tone="danger"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <X className="h-3 w-3" />
        </IconButton>
      </div>
    </div>
  );
}
