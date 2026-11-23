"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  type ReactNode,
} from "react";

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
  // Une Server Action passee d'un composant serveur a un composant client n'a
  // pas d'identite stable entre deux rendus RSC : elle est recreee a chaque
  // payload. La garder dans une ref empeche ce changement de se propager au
  // contexte, sinon chaque consommateur re-rend et relance ses effets de
  // chargement en boucle (#251).
  const callRef = useRef(call);
  useEffect(() => {
    callRef.current = call;
  }, [call]);

  const value = useMemo<ModuleActionsValue>(
    () => ({
      moduleId,
      call: (id, name, input) => callRef.current(id, name, input),
    }),
    [moduleId]
  );

  return <ModuleActionsContext.Provider value={value}>{children}</ModuleActionsContext.Provider>;
}

/** Rend une fonction `(action, entree) => promesse`, liee au module courant. */
export function useModuleAction(): ModuleActionCall {
  const context = useContext(ModuleActionsContext);
  if (!context) {
    throw new Error("useModuleAction doit etre utilise dans une page de module.");
  }
  const { moduleId, call } = context;

  // Meme raison qu'au-dessus, en defense : l'identite rendue ne doit dependre
  // que du module, jamais de l'identite de l'invocation. Sans cette phrase,
  // quelqu'un « simplifiera » en remettant `call` dans les dependances, et la
  // boucle de chargement reviendra dans toutes les pages de module.
  const callRef = useRef(call);
  useEffect(() => {
    callRef.current = call;
  }, [call]);

  return useCallback(
    (name: string, input?: unknown) => callRef.current(moduleId, name, input),
    [moduleId]
  );
}
