"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

const STORAGE_KEY = "pb-theme";
const EVENT = "pb-theme-change";

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
}

function getSnapshot(): "light" | "dark" {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function getServerSnapshot(): null {
  return null;
}

/**
 * Bascule clair / sombre de la landing.
 * Sans choix enregistré, le thème suit `prefers-color-scheme` (script
 * bloquant dans le layout) ; le bouton force l'autre et le mémorise.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore<"light" | "dark" | null>(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );

  const toggle = () => {
    const next = getSnapshot() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // stockage indisponible : le choix ne survivra pas à la navigation
    }
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={className ?? "icon-button"}
      aria-label={
        theme === "dark" ? "Passer au thème clair" : "Passer au thème sombre"
      }
      title={theme === "dark" ? "Thème clair" : "Thème sombre"}
    >
      {theme === "dark" ? (
        <Sun className="h-4 w-4" strokeWidth={1.6} aria-hidden />
      ) : (
        <Moon className="h-4 w-4" strokeWidth={1.6} aria-hidden />
      )}
    </button>
  );
}
