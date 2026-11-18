"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Panneaux declares par les modules (ADR 0001, decision G).
 *
 * Le panneau est monte une seule fois, dans le layout racine (composant
 * serveur), et transmis au chrome client par ce contexte. Un module desactive
 * n'apparait pas : le noyau ne construit que les panneaux actifs.
 */
export interface ModulePanel {
  readonly id: string;
  readonly label: string;
  readonly node: ReactNode;
}

const ModulePanelContext = createContext<readonly ModulePanel[]>([]);

export function ModulePanelProvider({
  panels,
  children,
}: {
  panels: readonly ModulePanel[];
  children: ReactNode;
}) {
  return <ModulePanelContext.Provider value={panels}>{children}</ModulePanelContext.Provider>;
}

export function useModulePanels(): readonly ModulePanel[] {
  return useContext(ModulePanelContext);
}
