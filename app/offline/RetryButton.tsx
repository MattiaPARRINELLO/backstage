"use client";

export function RetryButton() {
  return (
    <button
      onClick={() => window.location.reload()}
      className="ui-btn ui-btn--ghost mt-8"
    >
      Réessayer
    </button>
  );
}
