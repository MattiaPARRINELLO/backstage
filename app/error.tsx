"use client";

import { useSyncExternalStore } from "react";

import { requestIdFromCookie } from "@/lib/request-ref";

const subscribe = () => () => {};
const readRequestId = () => requestIdFromCookie(document.cookie);
const readEmptyRequestId = () => "";

// Boundary d'erreur global : toute erreur de rendu d'une page affiche un
// écran utile avec bouton Réessayer au lieu de la page Next générique.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const requestId = useSyncExternalStore(subscribe, readRequestId, readEmptyRequestId);

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center bg-[var(--background)]">
      <p className="text-[length:var(--t-small)] ui-mono  text-[var(--accent)] mb-4">
        BACKSTAGE
      </p>
      <h1 className="text-[length:var(--t-lead)] font-display font-bold text-[var(--text-1)] mb-3">
        Oups, une erreur est survenue
      </h1>
      <p className="text-[length:var(--t-small)] text-[var(--text-3)] max-w-sm leading-relaxed mb-6">
        {error.digest
          ? `Référence : ${error.digest}`
          : "L'affichage de cette page a échoué. Réessaie ou recharge la page."}
      </p>
      {requestId ? (
        <div className="mb-6 flex flex-col items-center gap-2">
          <p className="text-[length:var(--t-small)] text-[var(--text-3)]">
            Réf. requête : <code className="ui-mono select-all text-[var(--text-1)]">{requestId}</code>
          </p>
          <button
            onClick={() => void navigator.clipboard.writeText(requestId)}
            className="px-3 py-1.5 rounded-[var(--r-sm)] border border-[var(--border-2)] text-[var(--text-2)] text-[length:var(--t-small)] hover:bg-[var(--surface-2)] transition-colors duration-200"
          >
            Copier la référence
          </button>
        </div>
      ) : null}
      <button
        onClick={reset}
        className="px-4 py-2 rounded-[var(--r-sm)] bg-[var(--accent)] text-[var(--background)] font-medium text-[length:var(--t-small)] hover:brightness-110 active:brightness-95 transition-colors duration-200"
      >
        Réessayer
      </button>
    </div>
  );
}
