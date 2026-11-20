import type { ConfirmResult } from "@/components/chat/use-pending-actions";

// Resume lisible d'une action IA en attente de confirmation, pour la carte
// Confirmer/Annuler. Aucun argument n'est affiche integralement (confidentialite).
export function describeAction(name: string, args: Record<string, unknown>): string {
  switch (name) {
    case "send_email_response":
      return `Répondre à l'email ${String(args.email_id ?? "?")} : « ${String(args.response_text ?? "").slice(0, 140)}${String(args.response_text ?? "").length > 140 ? "…" : ""} »`;
    case "emails.reply":
      return `Répondre à l'email ${String(args.email_id ?? "?")} : « ${String(args.response_text ?? "").slice(0, 140)}${String(args.response_text ?? "").length > 140 ? "…" : ""} »`;
    case "create_calendar_event":
      return `Créer l'événement « ${String(args.title ?? "")} » du ${String(args.start_time ?? "?")} au ${String(args.end_time ?? "?")}${args.location ? ` (${String(args.location)})` : ""}`;
    case "calendar.create":
      return `Créer l'événement « ${String(args.title ?? "")} » du ${String(args.start_time ?? "?")} au ${String(args.end_time ?? "?")}${args.location ? ` (${String(args.location)})` : ""}`;
    case "update_calendar_event":
      return `Modifier l'événement ${String(args.event_id ?? "?")}${args.title ? ` → « ${String(args.title)} »` : ""}`;
    case "calendar.update":
      return `Modifier l'événement ${String(args.event_id ?? "?")}${args.title ? ` → « ${String(args.title)} »` : ""}`;
    case "delete_calendar_event":
      return `Supprimer l'événement ${String(args.event_id ?? "?")}`;
    case "calendar.delete":
      return `Supprimer l'événement ${String(args.event_id ?? "?")}`;
    case "schedule_followup":
      return `Programmer une relance « ${String(args.subject ?? "")} » pour le ${String(args.due_at ?? "?")}`;
    case "followups.schedule":
      return `Programmer une relance « ${String(args.subject ?? "")} » pour le ${String(args.due_at ?? "?")}`;
    case "scan_accreditations":
      return "Analyser les emails pour créer ou mettre à jour les fiches d'accréditations";
    case "accreditations.scan":
      return "Analyser les emails pour créer ou mettre à jour les fiches d'accréditations";
    default:
      return "";
  }
}

// Statut affiche pour un appel d'outil confirme, tel que reporte par le serveur.
export function confirmedPatch(result: ConfirmResult): {
  result: string;
  status: "success" | "error";
} {
  return {
    result: result.ok ? (result.result ?? "OK") : (result.error ?? "Échec"),
    status: result.ok ? "success" : "error",
  };
}
