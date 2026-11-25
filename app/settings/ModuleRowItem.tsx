"use client";

import { useState } from "react";
import { AlertTriangle, Trash2 } from "lucide-react";

import { removeModuleById, setModuleEnabled } from "@/app/actions/modules";
import { Button } from "@/components/ui/Button";
import { Pill } from "@/components/ui/Pill";
import type { ModuleRow } from "@/lib/kernel/module-admin";

import type { ActionMessage } from "./ModulesList";

/**
 * Une ligne de module : etat reel, version, problemes du doctor, bascule et
 * retrait. Le retrait est confirme en deux temps parce qu'il touche quatre
 * fichiers du depot.
 */

const STATUS_LABEL: Record<ModuleRow["status"], string> = {
  active: "Applique",
  inactive: "Desactive",
  rebuild: "Rebuild requis",
};

const STATUS_TONE: Record<ModuleRow["status"], "success" | "muted" | "warning"> = {
  active: "success",
  inactive: "muted",
  rebuild: "warning",
};

function toggleHint(row: ModuleRow): string | undefined {
  if (!row.served) return "Module absent de ce build : rebuild requis";
  if (row.blocked) return "Corrige les problemes du doctor avant de basculer";
  if (row.status === "rebuild") return "Rebuild requis avant de basculer";
  return undefined;
}

export function ModuleRowItem({
  row,
  onDone,
}: {
  row: ModuleRow;
  onDone: (message: ActionMessage) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const removable = row.commit !== null && !row.bundled;
  const toggling = row.served && !row.blocked && row.status !== "rebuild";

  const run = async (action: () => Promise<string>) => {
    setBusy(true);
    setError(null);
    try {
      onDone({ ok: true, text: await action() });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Operation impossible.");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const toggle = () =>
    run(async () => {
      await setModuleEnabled({ id: row.id, enabled: !row.active });
      return `Module ${row.id} ${row.active ? "desactive" : "active"}.`;
    });

  const remove = () =>
    run(async () => {
      await removeModuleById({ id: row.id });
      return `Module ${row.id} retire. Rebuild requis.`;
    });

  return (
    <li className="ui-tile p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[length:var(--t-body)] font-medium text-[var(--text-1)]">
              {row.label}
            </p>
            <Pill tone={STATUS_TONE[row.status]} dot>
              {STATUS_LABEL[row.status]}
            </Pill>
            {row.bundled && <Pill tone="neutral">Integre</Pill>}
          </div>
          <p className="ui-mono mt-1 text-[var(--text-3)]">{row.id}</p>
          {row.repo !== null && (
            <p className="mt-1 break-all text-[var(--t-small)] text-[var(--text-3)]">
              {row.repo}
              <span className="ui-mono">#{row.ref}</span>
              {row.commit && <span className="ui-mono"> @ {row.commit.slice(0, 7)}</span>}
            </p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button
            variant="secondary"
            size="md"
            onClick={toggle}
            disabled={busy || !toggling}
            title={toggleHint(row)}
          >
            {row.active ? "Desactiver" : "Activer"}
          </Button>
          {removable &&
            (confirming ? (
              <>
                <Button variant="danger" size="md" onClick={remove} disabled={busy}>
                  Confirmer
                </Button>
                <Button
                  variant="ghost"
                  size="md"
                  onClick={() => setConfirming(false)}
                  disabled={busy}
                >
                  Annuler
                </Button>
              </>
            ) : (
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Retirer le module ${row.label}`}
                title="Retirer"
                onClick={() => setConfirming(true)}
                disabled={busy}
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.6} />
              </Button>
            ))}
        </div>
      </div>

      {confirming && (
        <p className="mt-3 text-[var(--t-small)] leading-relaxed text-[var(--warning)]">
          Le dossier <span className="ui-mono">modules/{row.id}</span>, l&apos;entree de config, la
          composition et le lock seront retires. Un rebuild est requis.
        </p>
      )}

      {row.issues.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1">
          {row.issues.map((issue) => (
            <li
              key={issue}
              className="flex items-start gap-2 text-[var(--t-small)] text-[var(--danger)]"
            >
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.6} />
              <span>{issue}</span>
            </li>
          ))}
        </ul>
      )}

      {row.blocked && (
        <p className="mt-2 text-[var(--t-small)] text-[var(--text-3)]">
          Module en erreur : corrige le probleme du doctor avant de le basculer.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-2 text-[var(--t-small)] text-[var(--danger)]">
          {error}
        </p>
      )}
    </li>
  );
}
