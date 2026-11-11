"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import type { LandingContent } from "@/app/landing-content";

/**
 * Bloc d'installation en une commande (style terminal).
 * Le bouton copie la commande exacte servie par /install.sh — le visiteur
 * n'a rien à retaper et ne peut pas se tromper d'URL. C'est le seul
 * monospace de la page, et il s'agit de vrai code.
 */
export function InstallCommand({ t }: { t: LandingContent }) {
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
      await navigator.clipboard.writeText(t.installCommand);
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
        <span>{t.selfHost.terminalTitle}</span>
        <button
          type="button"
          onClick={() => void copy()}
          className="terminal__copy"
          aria-label={copied ? t.ui.commandCopied : t.ui.copyCommand}
        >
          <span className="inline-flex items-center gap-2">
            {copied ? (
              <Check className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            ) : (
              <Copy className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            )}
            {copied ? t.ui.copied : t.ui.copy}
          </span>
        </button>
      </div>
      <pre className="terminal__pre">
        <code>{t.installCommand}</code>
      </pre>
      <p className="terminal__note">{t.selfHost.terminalNote}</p>
    </div>
  );
}
