"use client";

import { useState } from "react";
import { cancelIntention } from "@/app/actions/intentions";

export function CancelIntentionButton({ id }: { id: string }) {
  const [cancelled, setCancelled] = useState(false);

  return (
    <button
      onClick={async () => {
        try {
          await cancelIntention(id);
          setCancelled(true);
        } catch {
          // L'erreur est silencieuse : le bouton reste cliquable pour réessayer.
        }
      }}
      disabled={cancelled}
      className="ui-mono self-start text-left text-[var(--text-3)] transition-colors duration-150 hover:text-[var(--danger)] disabled:cursor-default disabled:opacity-40"
    >
      {cancelled ? "Annulée" : "Annuler"}
    </button>
  );
}
