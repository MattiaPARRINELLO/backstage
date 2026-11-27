"use client";

import { Loader2 } from "lucide-react";
import { useState } from "react";
import { updateModels } from "@/app/actions/settings";
import { Row, Section } from "./SettingsSection";
import type { ModelSelection, RuntimeInfo } from "./useRuntimeInfo";

export function SettingsModels({
  runtime,
  modelSel,
  setModelSel,
}: {
  runtime: RuntimeInfo | null;
  modelSel: ModelSelection | null;
  setModelSel: (models: ModelSelection | null) => void;
}) {
  const [modelSaving, setModelSaving] = useState(false);
  const [modelMsg, setModelMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const available = runtime?.availableModels ?? [];
  // Un identifiant peut disparaitre du catalogue entre deux deploiements. On
  // le signale avant l'enregistrement : la Server Action leve une AppError
  // dont le message est masque par Next en production, ce qui donnait un
  // ecran « erreur React » au lieu d'une explication.
  const isStale = (value: string) => available.length > 0 && !available.includes(value);
  const staleFields = modelSel
    ? ([
        isStale(modelSel.general) ? "principal" : null,
        isStale(modelSel.generalAlt) ? "secours" : null,
        isStale(modelSel.code) ? "code" : null,
      ].filter(Boolean) as string[])
    : [];

  const pickAvailable = (current: string, index: number) =>
    isStale(current) ? (available[index] ?? available[0] ?? current) : current;

  const handleFixModels = () => {
    if (!modelSel) return;
    setModelSel({
      general: pickAvailable(modelSel.general, 0),
      generalAlt: pickAvailable(modelSel.generalAlt, 1),
      code: pickAvailable(modelSel.code, 2),
    });
    setModelMsg(null);
  };

  const handleModelsSave = async () => {
    if (!modelSel) return;
    if (staleFields.length > 0) {
      setModelMsg({
        ok: false,
        text: `Modele indisponible : ${staleFields.join(", ")}. Choisis une entree de la liste.`,
      });
      return;
    }
    setModelSaving(true);
    setModelMsg(null);
    try {
      await updateModels(modelSel);
      setModelMsg({ ok: true, text: "Modèles mis à jour ✓" });
    } catch (e) {
      setModelMsg({ ok: false, text: e instanceof Error ? e.message : "Erreur" });
    } finally {
      setModelSaving(false);
    }
  };

  // Le modèle actuellement sélectionné doit toujours être représenté dans le
  // select, même s'il n'apparaît plus dans la liste de l'API.
  const modelOptions = (m: string | undefined) => {
    const opts = available;
    if (m && !opts.includes(m)) return [...opts, m];
    return opts;
  };

  return (
    <Section
      title="Intelligence"
      description="Le modèle principal, son secours en cas d'échec, et celui des sessions de code."
    >
      {modelSel === null ? (
        <Row label="Modèles" hint="Chargement des modèles…" />
      ) : (
        <>
          {staleFields.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] py-4">
              <p className="text-[var(--t-small)]" style={{ color: "var(--danger)" }}>
                Modèle(s) indisponible(s) : {staleFields.join(", ")}. Le provider ne
                les sert plus.
              </p>
              <button
                type="button"
                className="ui-btn ui-btn--ghost ui-btn--sm px-4 text-[var(--t-small)]"
                onClick={handleFixModels}
              >
                Choisir un modèle disponible
              </button>
            </div>
          )}

          <Row label="Modèle principal" hint="Utilisé pour les conversations du chat.">
            <select
              value={modelSel.general}
              onChange={(e) => setModelSel({ ...modelSel, general: e.target.value })}
              className="ui-field w-full cursor-pointer text-[var(--t-small)] sm:w-56"
              aria-label="Modèle principal"
            >
              {modelOptions(runtime?.models.general).map((m) => (
                <option key={m} value={m}>
                  {m}
                  {isStale(m) ? " (indisponible)" : ""}
                </option>
              ))}
            </select>
          </Row>

          <Row
            label="Modèle de secours"
            hint="Pris automatiquement si le modèle principal échoue."
          >
            <select
              value={modelSel.generalAlt}
              onChange={(e) => setModelSel({ ...modelSel, generalAlt: e.target.value })}
              className="ui-field w-full cursor-pointer text-[var(--t-small)] sm:w-56"
              aria-label="Modèle de secours"
            >
              {modelOptions(runtime?.models.generalAlt).map((m) => (
                <option key={m} value={m}>
                  {m}
                  {isStale(m) ? " (indisponible)" : ""}
                </option>
              ))}
            </select>
          </Row>

          <Row label="Modèle code" hint="Utilisé pour les sessions de code.">
            <select
              value={modelSel.code}
              onChange={(e) => setModelSel({ ...modelSel, code: e.target.value })}
              className="ui-field w-full cursor-pointer text-[var(--t-small)] sm:w-56"
              aria-label="Modèle code"
            >
              {modelOptions(runtime?.models.code).map((m) => (
                <option key={m} value={m}>
                  {m}
                  {isStale(m) ? " (indisponible)" : ""}
                </option>
              ))}
            </select>
          </Row>

          <div className="border-b border-[var(--line)] py-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="ui-btn ui-btn--primary h-10 px-5 text-[var(--t-small)]"
                onClick={() => void handleModelsSave()}
                disabled={modelSaving || staleFields.length > 0}
              >
                {modelSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : null}
                {modelSaving ? "Sauvegarde…" : "Sauvegarder"}
              </button>
              {modelMsg && (
                <p
                  role="status"
                  className="text-[var(--t-small)]"
                  style={{ color: modelMsg.ok ? "var(--success)" : "var(--danger)" }}
                >
                  {modelMsg.text}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </Section>
  );
}
