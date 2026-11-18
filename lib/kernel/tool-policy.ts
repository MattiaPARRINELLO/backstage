import { resolveModuleTool } from "./tool-bridge";

/**
 * Politique des outils historiques du noyau.
 *
 * Ces listes disparaîtront avec les derniers `case` du dispatch : un outil de
 * module déclare son effet de bord dans son manifeste, et le noyau en dérive
 * tout. Elles ne concernent donc plus que les outils pas encore migrés.
 */

// Seul l'envoi d'emails exige une confirmation explicite de l'utilisateur via
// /api/chat/confirm. Le modèle ne peut jamais l'exécuter seul.
//
// Exception permanente : `add_memory_fact` est aussi gate, car un fait piege
// est reinjecte dans le prompt systeme des tours suivants (empoisonnement
// durable de la memoire). Cf. #74.
export const REQUIRE_CONFIRMATION = new Set<string>([
  "send_email_response",
  "add_memory_fact",
]);

// Outils dont le resultat provient d'une source exterieure non fiable (page
// web, email, issue GitHub, meteo, description d'evenement). Lire l'un d'eux
// contamine le tour : toute ecriture qui suit doit etre confirmee.
export const UNTRUSTED_TOOLS: ReadonlySet<string> = new Set([
  "web_search",
  "fetch_and_search_emails",
  "fetch_page_meta",
  "triage_emails",
  "search_calendar_events",
  "list_github_issues",
  "lookup_concerts",
  // prepare_concert renvoie le resultat d'un web_search (infos salle).
  "prepare_concert",
]);

// Outils qui modifient des donnees (locales, calendrier, email, GitHub,
// memoire). En tour contamine, ils passent par la meme carte de confirmation
// que `send_email_response`.
export const WRITE_TOOLS: ReadonlySet<string> = new Set([
  "send_email_response",
  "create_calendar_event",
  "update_calendar_event",
  "delete_calendar_event",
  "schedule_followup",
  "add_photo_shoot",
  "update_photo_shoot",
  "scan_accreditations",
  "add_memory_fact",
  "create_github_issue",
]);

// Outils qu'une confirmation utilisateur peut réellement débloquer : ceux qui
// exigent une confirmation permanente (`REQUIRE_CONFIRMATION`) et ceux qu'une
// écriture en tour contaminé met en attente (`WRITE_TOOLS`). C'est exactement
// le pendant de ce que `/api/chat` enregistre dans le registre des actions en
// attente ; toute autre valeur est refusée avant le moindre effet de bord.
// Le registre reste la vraie autorisation (usage unique, arguments figés).
export const CONFIRMABLE_TOOLS: ReadonlySet<string> = new Set([
  ...REQUIRE_CONFIRMATION,
  ...WRITE_TOOLS,
]);

/**
 * Politique d'un outil, quelle que soit son origine.
 *
 * Un nom ancien (`add_reminder`) est normalisé avant la recherche : les
 * historiques de conversation et les cartes déjà enregistrées continuent de
 * répondre correctement après le renommage.
 */
export interface ToolPolicy {
  readonly requiresConfirmation: boolean;
  readonly confirmable: boolean;
  /** Une écriture, donc sensible à la provenance du tour. */
  readonly write: boolean;
  readonly untrusted: boolean;
}

export function toolPolicy(name: string): ToolPolicy {
  const moduleTool = resolveModuleTool(name);
  if (moduleTool) {
    return {
      requiresConfirmation: moduleTool.requiresConfirmation,
      confirmable: moduleTool.confirmable,
      write: moduleTool.definition.sideEffect === "write",
      untrusted: moduleTool.untrusted,
    };
  }
  return {
    requiresConfirmation: REQUIRE_CONFIRMATION.has(name),
    confirmable: CONFIRMABLE_TOOLS.has(name),
    write: WRITE_TOOLS.has(name),
    untrusted: UNTRUSTED_TOOLS.has(name),
  };
}
