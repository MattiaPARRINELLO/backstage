"use client";

import { createContext, useCallback, useContext, useMemo, type ReactNode } from "react";

/**
 * Invocation des actions d'un module depuis sa page (ADR 0001, decision G).
 *
 * Une page de module n'importe pas `kernelAction` : elle importerait le noyau,
 * donc le registre, donc la page elle-meme (cycle). Le noyau fournit a la place
 * une Server Action generique, liee au module par ce contexte.
 */

export type ModuleActionInvoker = (
  moduleId: string,
  name: string,
  input: unknown
) => Promise<unknown>;

export type ModuleActionCall = (name: string, input?: unknown) => Promise<unknown>;

interface ModuleActionsValue {
  readonly moduleId: string;
  readonly call: ModuleActionInvoker;
}

const ModuleActionsContext = createContext<ModuleActionsValue | null>(null);

export function ModuleActionsProvider({
  moduleId,
  call,
  children,
}: ModuleActionsValue & { children: ReactNode }) {
  const value = useMemo(() => ({ moduleId, call }), [moduleId, call]);
  return <ModuleActionsContext.Provider value={value}>{children}</ModuleActionsContext.Provider>;
}

/** Rend une fonction `(action, entree) => promesse`, liee au module courant. */
export function useModuleAction(): ModuleActionCall {
  const context = useContext(ModuleActionsContext);
  if (!context) {
    throw new Error("useModuleAction doit etre utilise dans une page de module.");
  }
  const { moduleId, call } = context;
  return useCallback(
    (name: string, input?: unknown) => call(moduleId, name, input),
    [moduleId, call]
  );
}
