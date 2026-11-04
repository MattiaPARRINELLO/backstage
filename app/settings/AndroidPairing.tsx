"use client";

import { useEffect, useState } from "react";
import { Loader2, Smartphone } from "lucide-react";
import {
  createAndroidPairLink,
  loadAndroidDevices,
} from "@/app/actions/push";

/**
 * Appairage de l'APK Android aux notifications natives (FCM).
 *
 * L'APK ne partage pas le cookie de session du TWA (qui vit dans Chrome) : on
 * génère ici un code à usage unique, puis le lien `backstage://pair?code=…`
 * transmet ce code à l'application installée.
 */
export function AndroidPairing() {
  const [devices, setDevices] = useState<{ count: number; lastSeenAt: string | null } | null>(null);
  const [pairing, setPairing] = useState(false);
  const [pair, setPair] = useState<
    { code: string; deepLink: string; androidIntent: string; expiresAt: string } | null
  >(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAndroidDevices()
      .then(setDevices)
      .catch(() => setDevices({ count: 0, lastSeenAt: null }));
  }, []);

  const handlePair = async () => {
    setPairing(true);
    setError(null);
    try {
      const link = await createAndroidPairLink();
      setPair(link);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setPairing(false);
    }
  };

  return (
    <div className="flex flex-col gap-3 border-b border-[var(--line)] py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[var(--t-small)] text-[var(--text-1)]">APK Android</p>
          <p className="text-[var(--t-micro)] text-[var(--text-3)]">
            {devices === null
              ? "Vérification…"
              : devices.count > 0
                ? `${devices.count} appareil(s) appairé(s) aux notifications natives`
                : "Aucun appareil appairé — les notifications push passent par la PWA"}
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
            <Smartphone className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
          )}
          {pairing ? "Génération…" : "Appairer l'APK"}
        </button>
      </div>

      {pair && (
        <div className="flex flex-col gap-2">
          <p className="text-[var(--t-micro)] text-[var(--text-3)]">
            Code valable jusqu&apos;à{" "}
            {new Date(pair.expiresAt).toLocaleTimeString("fr-FR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
            . Ouvre le lien sur le téléphone, ou saisis le code dans l&apos;APK.
          </p>
          <div className="ui-field h-11 justify-center">
            <code className="text-[var(--t-body)] tracking-[0.3em] text-[var(--text-1)]">
              {pair.code}
            </code>
          </div>
          <a
            href={pair.androidIntent}
            className="ui-btn ui-btn--primary h-10 px-4 text-[var(--t-small)]"
          >
            Ouvrir dans BACKSTAGE
          </a>
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
