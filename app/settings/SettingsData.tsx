"use client";

import { ArrowUpRight, Download, Loader2, ShieldAlert } from "lucide-react";
import { useState } from "react";
import { Row, Section } from "./SettingsSection";

export function SettingsData() {
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
  );
}
