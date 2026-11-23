import type { ModuleActionCall } from "@backstage/module-kit";

import type {
  WatchLaterCategory,
  WatchLaterData,
  WatchLaterItem,
} from "../schema";

/**
 * Adaptateur typé au-dessus de l'invocation d'actions fournie par le noyau.
 *
 * La page ne connait ni `kernelAction` ni le registre : elle recoit une
 * fonction `(action, entree) => promesse` et ne fait que la typer.
 */
export function watchLaterApi(call: ModuleActionCall) {
  return {
    load: () => call("load", {}) as Promise<WatchLaterData>,
    create: (input: {
      url: string;
      title: string;
      description?: string | undefined;
      thumbnail?: string | undefined;
      source?: string | undefined;
      category?: WatchLaterCategory | undefined;
    }) => call("create", input) as Promise<WatchLaterItem>,
    remove: (id: string) => call("remove", { id }) as Promise<boolean>,
    reorder: (orderedIds: string[]) =>
      call("reorder", { orderedIds }) as Promise<boolean>,
  };
}
