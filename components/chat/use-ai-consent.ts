"use client";

import { useCallback, useEffect, useState } from "react";

interface AiConsent {
  loaded: boolean;
  accepted: boolean;
  accept: () => Promise<void>;
}

// État et cycle du consentement IA : chargement au montage et acceptation.
// Rien n'est envoyé au provider tant que l'utilisateur n'a pas accepté l'écran
// de consentement (voir /privacy). Le bandeau, la garde d'envoi et leurs textes
// restent à la vue.
export function useAiConsent(): AiConsent {
  const [consent, setConsent] = useState<{ loaded: boolean; accepted: boolean }>({
    loaded: false,
    accepted: false,
  });

  useEffect(() => {
    let cancelled = false;
    import("@/app/actions/consent")
      .then(({ loadAiConsent }) => loadAiConsent())
      .then((state) => {
        if (!cancelled) setConsent({ loaded: true, accepted: state.aiConsent });
      })
      .catch(() => {
        if (!cancelled) setConsent({ loaded: true, accepted: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const accept = useCallback(async () => {
    try {
      const { acceptAiConsent } = await import("@/app/actions/consent");
      await acceptAiConsent(true);
      setConsent({ loaded: true, accepted: true });
    } catch {
      setConsent({ loaded: true, accepted: false });
    }
  }, []);

  return { loaded: consent.loaded, accepted: consent.accepted, accept };
}
