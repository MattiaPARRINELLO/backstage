"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { INSTALL_COMMAND, SELF_HOST } from "@/app/landing-content";

/**
 * Bloc d'installation en une commande (style terminal).
 * Le bouton copie la commande exacte servie par /install.sh — le visiteur
 * n'a rien à retaper et ne peut pas se tromper d'URL. C'est le seul
 * monospace de la page, et il s'agit de vrai code.
 */
export function InstallCommand() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(INSTALL_COMMAND);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2400);
    } catch {
      // Presse-papiers indisponible (contexte non sécurisé) : la commande
      // reste sélectionnable à la main dans le bloc.
    }
  };

  return (
    <div className="terminal">
      <div className="terminal__bar">
        <span>{SELF_HOST.terminalTitle}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="terminal__copy"
          aria-label={copied ? "Commande copiée" : "Copier la commande d'installation"}
        >
          <span className="inline-flex items-center gap-2">
            {copied ? (
              <Check className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            ) : (
              <Copy className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            )}
            {copied ? "Copié" : "Copier"}
          </span>
        </button>
      </div>
      <pre className="terminal__pre">
        <code>{INSTALL_COMMAND}</code>
      </pre>
      <p className="terminal__note">{SELF_HOST.terminalNote}</p>
    </div>
  );
}
