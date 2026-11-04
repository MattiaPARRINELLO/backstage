"use client";

import { useState } from "react";
import { Check, Copy, Fingerprint, Loader2 } from "lucide-react";
import { createPasskeyPairing } from "@/app/actions/passkey";

/**
 * Ajout d'une clé d'accès sur un autre appareil.
 *
 * Une passkey est liée à l'appareil qui l'a créée : le PC d'un utilisateur qui
 * s'inscrit sur son téléphone n'en a aucune, et l'enregistrement exige une
 * session (impossible sans clé sur place). On génère donc ici un code à usage
 * unique, ouvert sur l'autre appareil, qui autorise la cérémonie WebAuthn.
 */
export function PasskeyPairing() {
  const [pairing, setPairing] = useState(false);
  const [pair, setPair] = useState<{ code: string; expiresAt: string } | null>(null);
  const [link, setLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handlePair = async () => {
    setPairing(true);
    setError(null);
    setCopied(false);
    try {
      const created = await createPasskeyPairing();
      setPair(created);
      setLink(`${window.location.origin}/login?pair=${created.code}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setPairing(false);
    }
  };

  const handleCopy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
    } catch {
      setError("Copie impossible — ouvre le lien depuis cet écran.");
    }
  };

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--line)] py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[var(--t-small)] text-[var(--text-1)]">Clé d&apos;accès</p>
          <p className="text-[var(--t-micro)] text-[var(--text-3)]">
            Une clé est liée à l&apos;appareil qui l&apos;a créée. Pour te connecter depuis
            un autre appareil, enregistre-lui sa propre clé.
          </p>
        </div>
        <button
          type="button"
          className="ui-btn ui-btn--ghost h-9 px-4 text-[var(--t-small)]"
          onClick={() => void handlePair()}
          disabled={pairing}
        >
          {pairing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Fingerprint className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
          )}
          {pairing ? "Génération…" : "Ajouter un appareil"}
        </button>
      </div>

      {pair && (
        <div className="flex flex-col gap-2">
          <p className="text-[var(--t-micro)] text-[var(--text-3)]">
            Lien valable jusqu&apos;à{" "}
            {new Date(pair.expiresAt).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            . Ouvre-le sur l&apos;autre appareil, puis valide Face ID / empreinte.
          </p>
          <div className="ui-field h-11 justify-center">
            <code className="text-[var(--t-body)] tracking-[0.3em] text-[var(--text-1)]">
              {pair.code}
            </code>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="ui-field h-10 min-w-0 flex-1">
              <span className="truncate text-[var(--t-small)] text-[var(--text-2)]">{link}</span>
            </div>
            <button
              type="button"
              className="ui-btn ui-btn--primary h-10 shrink-0 px-4 text-[var(--t-small)]"
              onClick={() => void handleCopy()}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
              ) : (
                <Copy className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
              )}
              {copied ? "Copié" : "Copier le lien"}
            </button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="text-[var(--t-small)]" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
