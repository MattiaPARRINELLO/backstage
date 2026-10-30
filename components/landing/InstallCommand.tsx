"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { INSTALL_COMMAND } from "@/app/landing-content";

/**
 * Bloc d'installation en une commande (style terminal).
 * Le bouton copie la commande exacte servie par /install.sh — le visiteur
 * n'a rien à retaper et ne peut pas se tromper d'URL.
 */
export function InstallCommand() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

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
    <div className="mt-3 flex flex-col gap-2 sm:flex-row">
      <code className="install__cmd">{INSTALL_COMMAND}</code>
      <button
        type="button"
        onClick={() => void copy()}
        className="cta-secondary shrink-0"
        aria-label={copied ? "Commande copiée" : "Copier la commande d'installation"}
      >
        {copied ? <Check className="h-4 w-4" strokeWidth={1.5} /> : <Copy className="h-4 w-4" strokeWidth={1.5} />}
        {copied ? "Copié" : "Copier"}
      </button>
    </div>
  );
}
