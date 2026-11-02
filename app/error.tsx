"use client";

// Boundary d'erreur global : toute erreur de rendu d'une page affiche un
// écran utile avec bouton Réessayer au lieu de la page Next générique.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
      <button
        onClick={reset}
        className="px-4 py-2 rounded-[var(--r-sm)] bg-[var(--accent)] text-[var(--background)] font-medium text-[length:var(--t-small)] hover:brightness-110 active:brightness-95 transition-colors duration-200"
      >
        Réessayer
      </button>
    </div>
  );
}
