import type { ModuleActionCall } from "@backstage/module-kit";

import type {
  Accreditation,
  AccreditationStatus,
  AccreditationsData,
} from "../schema";

export interface AccreditationEditInput {
  id: string;
  artist?: string | undefined;
  venue?: string | undefined;
  concertDate?: string | undefined;
  contactEmail?: string | undefined;
  notes?: string | undefined;
}

export interface ScanResult {
  status: "ok" | "empty" | "error";
  text: string;
}

/**
 * Adaptateur typé au-dessus de l'invocation d'actions fournie par le noyau.
 *
 * La page ne connaît ni `kernelAction` ni le registre : elle reçoit une
 * fonction `(action, entrée) => promesse` et ne fait que la typer.
 */
export function accreditationsApi(call: ModuleActionCall) {
  return {
    load: () => call("load", {}) as Promise<AccreditationsData>,
    create: (input: {
      artist: string;
      venue: string;
      concertDate: string;
      contactEmail?: string | undefined;
      notes?: string | undefined;
    }) => call("create", input) as Promise<Accreditation>,
    edit: (input: AccreditationEditInput) =>
      call("edit", input) as Promise<Accreditation | null>,
    updateStatus: (id: string, status: AccreditationStatus) =>
      call("updateStatus", { id, status }) as Promise<Accreditation | null>,
    remove: (id: string) => call("remove", { id }) as Promise<boolean>,
    scan: () => call("scan", {}) as Promise<ScanResult>,
  };
}
