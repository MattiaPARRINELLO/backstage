"use client";

// Bandeau de consentement IA : affiche tant que l'utilisateur n'a pas accepte
// l'envoi de ses messages au provider. Aucun etat porte ici.
export function ChatConsentBanner({ onAccept }: { onAccept: () => void }) {
  return (
    <div className="shrink-0 pl-14 pr-4 py-3 lg:px-4 bg-[var(--surface-2)] fade-in">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-[length:var(--t-small)] font-medium text-[var(--text-1)]">
            Tes messages seront envoyés à une IA
          </p>
          <p className="text-[length:var(--t-small)] text-[var(--text-3)] mt-1 leading-relaxed">
            Ils servent uniquement à te répondre, jamais à entraîner un modèle.
            Tu peux tout exporter ou tout supprimer à tout moment.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <a
            href="/privacy"
            className="ui-mono text-[var(--text-3)] hover:text-[var(--text-1)] transition-colors duration-150"
          >
            Vie privée
          </a>
          <button
            onClick={onAccept}
            className="ui-btn ui-btn--primary ui-btn--sm"
          >
            J&apos;accepte
          </button>
        </div>
      </div>
    </div>
  );
}
