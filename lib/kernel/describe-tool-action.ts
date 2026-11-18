import { resolveModuleTool } from "./tool-bridge";

/**
 * Libellé lisible d'une action en attente de confirmation (aucun argument
 * affiché intégralement, confidentialité). Reflet serveur de `describeAction`
 * côté client (ChatView) pour le résumé du lot.
 *
 * Un outil de module fournit son propre libellé ; le noyau ne connaît plus ses
 * arguments métier. Les `case` restants ne concernent que les outils pas encore
 * migrés.
 */
export function describeToolAction(name: string, args: Record<string, unknown>): string {
  const moduleTool = resolveModuleTool(name);
  if (moduleTool) {
    try {
      return moduleTool.definition.describeAction?.(args) ?? name;
    } catch {
      return name;
    }
  }
  switch (name) {
    case "send_email_response":
      return `Répondre à l'email ${String(args.email_id ?? "?")}`;
    case "create_calendar_event":
      return `Créer l'événement « ${String(args.title ?? "")} » du ${String(args.start_time ?? "?")} au ${String(args.end_time ?? "?")}`;
    case "update_calendar_event":
      return `Modifier l'événement ${String(args.event_id ?? "?")}${args.title ? ` → « ${String(args.title)} »` : ""}`;
    case "delete_calendar_event":
      return `Supprimer l'événement ${String(args.event_id ?? "?")}`;
    case "schedule_followup":
      return `Programmer une relance « ${String(args.subject ?? "")} » pour le ${String(args.due_at ?? "?")}`;
    case "scan_accreditations":
      return "Analyser les emails pour créer ou mettre à jour les fiches d'accréditations";
    default:
      return name;
  }
}
