"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Toast fourni au module par le noyau (ADR 0001, decision G).
 *
 * Le noyau possede le rendu et l'etat ; le module ne recoit qu'une fonction.
 * Une page rendue hors de l'hote (`AppShell`) obtient `null` et reste utilisable.
 */

export type ModuleToastTone = "default" | "success" | "danger" | "info" | "warning";

export interface ModuleToastInput {
  message: string;
  tone?: ModuleToastTone;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export interface ModuleToasts {
  show: (toast: ModuleToastInput) => string;
  dismiss: (id: string) => void;
}

const ModuleToastContext = createContext<ModuleToasts | null>(null);

export function ModuleToastProvider({
  value,
  children,
}: {
  value: ModuleToasts;
  children: ReactNode;
}) {
  return <ModuleToastContext.Provider value={value}>{children}</ModuleToastContext.Provider>;
}

export function useModuleToasts(): ModuleToasts | null {
  return useContext(ModuleToastContext);
}
