"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Cartes d'accueil declarees par les modules (ADR 0001, decision G).
 *
 * Comme les panneaux, elles sont montees dans le layout racine (serveur) et
 * transmises au hero client par contexte. Un module desactive n'en produit
 * aucune.
 */
export interface ModuleHomeCard {
  readonly id: string;
  readonly node: ReactNode;
}

const ModuleHomeCardContext = createContext<readonly ModuleHomeCard[]>([]);

export function ModuleHomeCardProvider({
  cards,
  children,
}: {
  cards: readonly ModuleHomeCard[];
  children: ReactNode;
}) {
  return (
    <ModuleHomeCardContext.Provider value={cards}>{children}</ModuleHomeCardContext.Provider>
  );
}

export function useModuleHomeCards(): readonly ModuleHomeCard[] {
  return useContext(ModuleHomeCardContext);
}
