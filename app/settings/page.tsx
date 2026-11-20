"use client";

import {
  LogOut,
  Loader2,
  ShieldAlert,
  Download,
  ArrowUpRight,
} from "lucide-react";
import { useState, useEffect } from "react";
import { updateModels } from "@/app/actions/settings";
import { PasskeyPairing } from "./PasskeyPairing";
import { SettingsConnections } from "./SettingsConnections";
import { SettingsLeetcode } from "./SettingsLeetcode";
import { SettingsNotifications } from "./SettingsNotifications";
import { Row, Section } from "./SettingsSection";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/Chrome";
import { AccentPicker } from "@/components/ui/AccentPicker";

export default function SettingsPage() {
  const [runtime, setRuntime] = useState<{
    models: { general: string; generalAlt: string; code: string };
    availableModels: string[];
    features: { dailyBrief: boolean; webSearch: boolean };
    pushCount: number;
  } | null>(null);

  const [modelSel, setModelSel] = useState<{
    general: string;
    generalAlt: string;
    code: string;
  } | null>(null);
  const [modelSaving, setModelSaving] = useState(false);
  const [modelMsg, setModelMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    import("@/app/actions/settings")
      .then(({ loadRuntimeInfo }) => loadRuntimeInfo())
      .then((info) => {
        setRuntime(info);
        setModelSel({
          general: info.models.general,
          generalAlt: info.models.generalAlt,
          code: info.models.code,
        });
      })
      .catch(() => {});
  }, []);

  const handleModelsSave = async () => {
    if (!modelSel) return;
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
    const opts = runtime?.availableModels ?? [];
    if (m && !opts.includes(m)) return [...opts, m];
    return opts;
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      window.location.replace("/login");
    } catch (err) {
      console.error("Logout error", err);
    }
  };

  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const handleExport = async () => {
    setExporting(true);
    setExportMsg(null);
    try {
      const res = await fetch("/api/export", { credentials: "same-origin" });
      if (!res.ok) throw new Error("Export impossible");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backstage-export-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setExportMsg("Export téléchargé ✓");
    } catch (err) {
      setExportMsg(err instanceof Error ? err.message : "Erreur lors de l'export");
    } finally {
      setExporting(false);
    }
  };

  const [deleting, setDeleting] = useState(false);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);

  const handleDeleteAccount = async () => {
    if (
      !window.confirm(
        "Supprimer définitivement TOUTES tes données (conversations, rappels, mémoire, comptes Google connectés) ? Cette action est irréversible."
      )
    ) {
      return;
    }
    if (
      !window.confirm(
        "Confirmation finale : les sauvegardes automatiques seront supprimées aussi. Continuer ?"
      )
    ) {
      return;
    }
    setDeleting(true);
    setDeleteMsg(null);
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!res.ok) throw new Error("Suppression impossible");
      window.location.replace("/login");
    } catch (err) {
      setDeleteMsg(err instanceof Error ? err.message : "Erreur lors de la suppression");
      setDeleting(false);
    }
  };

  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
          <PageHeader
            title="Paramètres"
            description="Personnalise ton interface et gère tes connexions."
          />

          <Section
            title="Apparence"
            description="La couleur qui signale l'action et la donnée qui compte."
          >
            <Row label="Couleur d'accent" hint="Appliquée à toute l'interface.">
              <AccentPicker />
            </Row>
          </Section>

          <Section
            title="Intelligence"
            description="Le modèle principal, son secours en cas d'échec, et celui des sessions de code."
          >
            {modelSel === null ? (
              <Row label="Modèles" hint="Chargement des modèles…" />
            ) : (
              <>
                <Row label="Modèle principal" hint="Utilisé pour les conversations du chat.">
                  <select
                    value={modelSel.general}
                    onChange={(e) => setModelSel({ ...modelSel, general: e.target.value })}
                    className="ui-field w-full cursor-pointer text-[var(--t-small)] sm:w-56"
                    aria-label="Modèle principal"
                  >
                    {modelOptions(runtime?.models.general).map((m) => (
                      <option key={m} value={m}>{m}</option>
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
                      <option key={m} value={m}>{m}</option>
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
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </Row>

                <div className="border-b border-[var(--line)] py-4">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="ui-btn ui-btn--primary h-10 px-5 text-[var(--t-small)]"
                      onClick={() => void handleModelsSave()}
                      disabled={modelSaving}
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

          <SettingsConnections />

          <SettingsNotifications runtime={runtime} />

          <SettingsLeetcode />

          <Section
            title="Sécurité"
            description="Les clés qui ouvrent BACKSTAGE, et les appareils autorisés à en recevoir une."
          >
            <PasskeyPairing />
          </Section>

          <Section
            title="Données"
            description="Tout ce que BACKSTAGE sait de toi t'appartient."
          >
            <Row
              label="Exporter mes données"
              hint="Conversations, rappels, mémoire, emails en cache — un fichier JSON."
            >
              <button
                type="button"
                className="ui-btn ui-btn--ghost h-9 px-4 text-[var(--t-small)]"
                onClick={() => void handleExport()}
                disabled={exporting}
              >
                {exporting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Download className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
                )}
                {exporting ? "Export…" : "Exporter"}
              </button>
            </Row>

            {exportMsg && (
              <div className="border-b border-[var(--line)] py-3">
                <p
                  role="status"
                  className="text-[var(--t-small)]"
                  style={{
                    color: exportMsg.endsWith("✓") ? "var(--success)" : "var(--danger)",
                  }}
                >
                  {exportMsg}
                </p>
              </div>
            )}

            <Row label="Vie privée" hint="Comment les données sont stockées et utilisées.">
              <a
                href="/privacy"
                className="ui-btn ui-btn--text text-[var(--t-small)]"
              >
                Lire la politique
                <ArrowUpRight className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
              </a>
            </Row>

            <Row
              label="Supprimer mon compte"
              hint="Efface définitivement tes données, tes passkeys et tes connexions Google."
            >
              <button
                type="button"
                className="ui-btn ui-btn--ghost h-9 px-4 text-[var(--t-small)]"
                style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
                onClick={() => void handleDeleteAccount()}
                disabled={deleting}
              >
                {deleting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <ShieldAlert className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
                )}
                {deleting ? "Suppression…" : "Supprimer"}
              </button>
            </Row>

            {deleteMsg && (
              <div className="border-b border-[var(--line)] py-3">
                <p role="alert" className="text-[var(--t-small)]" style={{ color: "var(--danger)" }}>
                  {deleteMsg}
                </p>
              </div>
            )}
          </Section>

          <Section title="Session">
            <Row label="Déconnexion" hint="Ferme ta session sur cet appareil.">
              <button
                type="button"
                className="ui-btn ui-btn--ghost h-9 px-4 text-[var(--t-small)]"
                onClick={handleLogout}
              >
                <LogOut className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
                Déconnexion
              </button>
            </Row>
          </Section>

          <p className="mt-12 text-[var(--t-small)] text-[var(--text-3)]">
            BACKSTAGE — version web
          </p>
        </div>
      </div>
    </AppShell>
  );
}
