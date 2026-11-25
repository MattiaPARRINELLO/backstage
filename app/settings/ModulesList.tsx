"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Package, RefreshCw } from "lucide-react";

import type { ModuleCatalog } from "@/lib/kernel/module-catalog";
import type { ModulesState } from "@/lib/kernel/module-admin";
import { EmptyState } from "@backstage/module-kit";
import { cn } from "@/lib/utils";

import { ModuleInstaller } from "./ModuleInstaller";
import { ModuleRowItem } from "./ModuleRowItem";

/**
 * Ecran de gestion des modules (issue #270).
 *
 * Trois etats affiches sans ambiguite : `Applique` (le registre en cours sert
 * l'etat demande), `Rebuild requis` (la config et le build divergent) et
 * `Erreur` (le doctor refuse la bascule). Un module bloque ne se bascule pas :
 * le bouton est desactive et la raison est ecrite a cote.
 */

export interface ActionMessage {
  readonly ok: boolean;
  readonly text: string;
}

export function ModulesList({
  state,
  catalog,
}: {
  state: ModulesState;
  catalog: ModuleCatalog | null;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<ActionMessage | null>(null);

  const installedIds = new Set(
    state.modules.filter((row) => row.commit !== null).map((row) => row.id)
  );

  const onDone = (next: ActionMessage) => {
    setMessage(next);
    router.refresh();
  };

  return (
    <div className="mt-6 flex flex-col gap-3">
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={cn(
            "text-[var(--t-small)]",
            message.ok ? "text-[var(--success)]" : "text-[var(--danger)]"
          )}
        >
          {message.text}
        </p>
      )}

      {state.rebuildRequired && (
        <div className="ui-tile flex items-start gap-3 p-4">
          <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" strokeWidth={1.6} />
          <div>
            <p className="text-[length:var(--t-body)] text-[var(--text-1)]">Rebuild requis</p>
            <p className="mt-1 text-[var(--t-small)] leading-relaxed text-[var(--text-3)]">
              Un module a ete ajoute ou retire de{" "}
              <span className="ui-mono">modules/index.ts</span>. Cet ecran dit ce que sert le
              registre en cours, pas ce que fera le prochain build. Lance{" "}
              <span className="ui-mono">bun run build</span> puis redemarre le serveur.
            </p>
          </div>
        </div>
      )}

      {state.configSource === "build" && (
        <p className="text-[var(--t-small)] leading-relaxed text-[var(--text-3)]">
          Aucun <span className="ui-mono">modules.config.json</span> a la racine d&apos;execution :
          la configuration affichee est celle du build. La premiere bascule ecrira le fichier.
        </p>
      )}

      {state.modules.length === 0 ? (
        <EmptyState
          icon={<Package className="h-5 w-5" strokeWidth={1.6} />}
          title="Aucun module"
          description="Installe un module depuis un depot git pour commencer."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {state.modules.map((row) => (
            <ModuleRowItem key={row.id} row={row} onDone={onDone} />
          ))}
        </ul>
      )}

      {state.orphanIssues.length > 0 && (
        <div className="ui-tile p-4">
          <p className="text-[length:var(--t-body)] text-[var(--text-1)]">Dossiers temporaires</p>
          <ul className="mt-2 flex flex-col gap-1">
            {state.orphanIssues.map((issue) => (
              <li key={issue} className="text-[var(--t-small)] text-[var(--danger)]">
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ModuleInstaller catalog={catalog} installedIds={installedIds} onDone={onDone} />
    </div>
  );
}
