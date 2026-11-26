"use client";

import { useState } from "react";
import { Check, Download } from "lucide-react";

import { installModuleFromSource } from "@/app/actions/modules";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Pill } from "@/components/ui/Pill";
import type { ModuleCatalog } from "@/lib/kernel/module-catalog";

import type { ActionMessage } from "./ModulesList";

/**
 * Ajout d'un module (livrable 2 et 4 de l'issue #270).
 *
 * `installModule` gere deja snapshot et rollback : ce composant ne fait que
 * preparer puis confirmer une source. Une ref mobile est refusee ici et par le
 * noyau. Le catalogue pre-remplit la saisie et ne fait jamais foi.
 */

const MOBILE_REFS = new Set(["main", "master", "develop", "head"]);

interface PendingInstall {
  readonly repo: string;
  readonly ref: string;
  readonly env: readonly string[];
}

function parseSource(source: string): { repo: string; ref: string } | null {
  const separator = source.lastIndexOf("#");
  if (separator <= 0 || separator === source.length - 1) return null;
  const repo = source.slice(0, separator).trim();
  const ref = source.slice(separator + 1).trim();
  if (!repo || !ref) return null;
  return { repo, ref };
}

export function ModuleInstaller({
  catalog,
  installedIds,
  onDone,
}: {
  catalog: ModuleCatalog | null;
  installedIds: Set<string>;
  onDone: (message: ActionMessage) => void;
}) {
  const [source, setSource] = useState("");
  const [pending, setPending] = useState<PendingInstall | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const distributable = catalog?.entries.filter((entry) => entry.distributable) ?? [];

  const prepare = (raw: string, env: readonly string[] = []) => {
    setError(null);
    const parsed = parseSource(raw);
    if (parsed === null) {
      setError(
        "Source invalide : attendu <url-git>#<ref>, par exemple https://github.com/org/module.git#v1.0.0."
      );
      return;
    }
    if (MOBILE_REFS.has(parsed.ref.toLowerCase())) {
      setError(`Ref "${parsed.ref}" refusee : choisis un tag ou un commit.`);
      return;
    }
    setPending({ ...parsed, env });
  };

  const install = async () => {
    if (pending === null) return;
    setBusy(true);
    setError(null);
    try {
      const result = await installModuleFromSource({
        source: `${pending.repo}#${pending.ref}`,
      });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onDone({
        ok: true,
        text: `Module ${result.id} installe au commit ${result.commit.slice(0, 7)}. Rebuild requis.`,
      });
      setSource("");
      setPending(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Installation impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mt-10">
      <h2 className="font-display text-[length:var(--t-lead)] font-semibold tracking-[-0.025em] text-[var(--text-1)]">
        Ajouter un module
      </h2>
      <p className="mt-1.5 max-w-xl text-[var(--t-small)] leading-relaxed text-[var(--text-3)]">
        Depuis un depot git, avec une ref figee. Installer un module execute du code sur le
        serveur : verifie le depot et la ref avant de confirmer.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <Input
          value={source}
          onChange={(event) => setSource(event.target.value)}
          placeholder="https://github.com/org/module.git#v1.0.0"
          aria-label="Source du module"
        />
        <Button
          variant="secondary"
          size="lg"
          onClick={() => prepare(source)}
          disabled={busy || source.trim().length === 0}
        >
          Verifier
        </Button>
      </div>

      {catalog === null ? (
        <p className="mt-3 text-[var(--t-small)] text-[var(--text-3)]">
          Catalogue indisponible : la saisie manuelle reste possible.
        </p>
      ) : distributable.length === 0 ? (
        <p className="mt-3 text-[var(--t-small)] text-[var(--text-3)]">
          Le catalogue ne propose aucun module distribuable.
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-1">
          {distributable.map((entry) => {
            const installed = installedIds.has(entry.id);
            return (
              <li
                key={entry.id}
                className="flex flex-col gap-2 border-b border-[var(--line)] py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[var(--t-small)] font-medium text-[var(--text-1)]">
                      {entry.id}
                    </p>
                    {installed && <Pill tone="neutral">Deja installe</Pill>}
                    {entry.visibility === "private" && <Pill tone="warning">Depot prive</Pill>}
                  </div>
                  <p className="mt-1 break-all text-[var(--t-small)] text-[var(--text-3)]">
                    {entry.description}
                  </p>
                  <p className="ui-mono mt-1 break-all text-[var(--text-4)]">
                    {entry.repo}#{entry.ref}
                  </p>
                  {entry.requiresToken && (
                    <p className="mt-1 text-[var(--t-small)] text-[var(--warning)]">
                      Jeton GitHub requis : le clone echouera sans GITHUB_TOKEN.
                    </p>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="md"
                  className="shrink-0"
                  disabled={installed || busy || entry.repo === null || entry.ref === null}
                  onClick={() => prepare(`${entry.repo}#${entry.ref}`, entry.env)}
                >
                  <Download className="h-4 w-4" strokeWidth={1.6} />
                  Utiliser
                </Button>
              </li>
            );
          })}
        </ul>
      )}

      {pending !== null && (
        <div className="ui-tile mt-4 p-4">
          <p className="text-[length:var(--t-body)] text-[var(--text-1)]">
            Confirmer l&apos;installation
          </p>
          <dl className="mt-2 flex flex-col gap-1 text-[var(--t-small)]">
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-[var(--text-3)]">Depot</dt>
              <dd className="ui-mono min-w-0 break-all text-[var(--text-2)]">{pending.repo}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-[var(--text-3)]">Ref</dt>
              <dd className="ui-mono min-w-0 break-all text-[var(--text-2)]">{pending.ref}</dd>
            </div>
            <div className="flex gap-2">
              <dt className="w-20 shrink-0 text-[var(--text-3)]">Capacites</dt>
              <dd className="min-w-0 break-all text-[var(--text-2)]">
                {pending.env.length > 0
                  ? `variables d'environnement : ${pending.env.join(", ")}`
                  : "declarees dans le manifeste, lues apres le clone"}
              </dd>
            </div>
          </dl>
          <p className="mt-2 text-[var(--t-small)] text-[var(--text-3)]">
            Le clone est epingle sur un commit fige dans{" "}
            <span className="ui-mono">modules.lock.json</span>. Une installation qui echoue
            restaure les fichiers, sans rollback manuel.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <Button variant="primary" size="md" onClick={install} disabled={busy}>
              <Check className="h-4 w-4" strokeWidth={1.6} />
              Installer ce module
            </Button>
            <Button variant="ghost" size="md" onClick={() => setPending(null)} disabled={busy}>
              Annuler
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[var(--t-small)] text-[var(--danger)]">
          {error}
        </p>
      )}
    </section>
  );
}
