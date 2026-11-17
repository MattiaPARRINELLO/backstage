/**
 * Bus d'événements du noyau.
 *
 * En mémoire, livraison « au mieux » : un redémarrage perd les événements non
 * traités, et aucun module ne peut compter sur un rejeu. C'est la limite
 * assumée de l'ADR 0001 (décision I) pour une application mono-utilisateur.
 *
 * Un module publie **après** que son écriture a réussi, jamais avant.
 */
export type EventHandler = (payload: unknown) => void | Promise<void>;

const handlers = new Map<string, Set<EventHandler>>();

/** Abonne un gestionnaire. Retourne la fonction de désabonnement. */
export function on(event: string, handler: EventHandler): () => void {
  const set = handlers.get(event) ?? new Set<EventHandler>();
  set.add(handler);
  handlers.set(event, set);
  return () => {
    set.delete(handler);
    if (set.size === 0) handlers.delete(event);
  };
}

/**
 * Publie un événement. Une erreur d'abonné n'interrompt pas les suivants et ne
 * remonte pas à l'émetteur : le module qui a écrit ses données ne doit pas
 * échouer parce qu'un écouteur a levé.
 */
export function emit(event: string, payload?: unknown): void {
  const set = handlers.get(event);
  if (!set) return;
  for (const handler of [...set]) {
    try {
      Promise.resolve(handler(payload)).catch((error) => {
        console.error(`[events] Abonne en echec sur "${event}"`, error);
      });
    } catch (error) {
      console.error(`[events] Abonne en echec sur "${event}"`, error);
    }
  }
}

/** Vide le bus. Réservé aux tests. */
export function clearEventHandlers(): void {
  handlers.clear();
}
