/**
 * Statut d'exécution d'un outil, lisible par la machine.
 *
 * Pourquoi : un résultat d'outil est aujourd'hui une simple chaîne de texte.
 * Le modèle devine si l'action a marché d'après le libellé ("Erreur ...",
 * "introuvable"), et certaines chaînes de succès sont renvoyées même quand
 * rien n'a été fait. D'où les réponses du type « c'est fait » alors que
 * l'action a échoué. Chaque exécution porte désormais un statut explicite.
 */
export type ToolStatus = "ok" | "error" | "empty" | "blocked";

/** Préfixe employé dans le texte renvoyé au modèle. */
export const TOOL_STATUS_MARKER: Record<ToolStatus, string> = {
  ok: "OK",
  error: "ERREUR",
  empty: "VIDE",
  blocked: "BLOQUE",
};

// Libellés qui signalent un échec réel, quelle que soit leur position dans la
// phrase (les outils ne préfixent pas tous par "Erreur").
const ERROR_PATTERN =
  /(^|\s)(erreur|impossible|introuvable|inconnu|non configur|echec|echou|refus|timeout|expire)/i;

// Résultat nominal mais vide : la source répond, il n'y a simplement rien.
// Ce n'est pas un échec, mais ce n'est pas un succès exploitable non plus.
//
// « Rien de nouveau / déjà en mémoire » en fait partie : un dédoublonnage ne
// prouve pas que l'information demandée a été enregistrée. Classé en succès,
// il laissait le modèle annoncer « c'est retenu » alors que rien n'avait été
// écrit. En `empty`, la règle d'honnêteté (TOOL_HONESTY_RULE) s'applique.
const EMPTY_PATTERN =
  /^(aucun|aucune|pas de|rien|fait deja connu|deja connu|deja memorise|deja en memoire)\b/i;

/**
 * Déduit le statut d'un texte de résultat. `blocked` est détecté avant tout
 * le reste : c'est une attente de confirmation, pas un échec technique.
 */
export function classifyToolText(text: string): ToolStatus {
  const trimmed = (text ?? "").trim();
  if (!trimmed) return "empty";
  if (trimmed.startsWith("ACTION_BLOCKED")) return "blocked";
  if (ERROR_PATTERN.test(trimmed)) return "error";
  if (EMPTY_PATTERN.test(trimmed)) return "empty";
  return "ok";
}

/** Texte transmis au modèle, statut en tête : `[ERREUR] Rappel introuvable.` */
export function renderToolText(status: ToolStatus, text: string): string {
  const body = (text ?? "").trim();
  return `[${TOOL_STATUS_MARKER[status]}] ${body}`;
}

/** Relit un texte déjà rendu (historique, carte d'action, autre exécutant). */
export function parseToolText(raw: string): { status: ToolStatus; text: string } {
  const match = /^\[(OK|ERREUR|VIDE|BLOQUE)\]\s?/.exec((raw ?? "").trim());
  if (!match) return { status: classifyToolText(raw ?? ""), text: raw ?? "" };
  const marker = match[1] as keyof typeof TOOL_STATUS_MARKER;
  const status = (Object.keys(TOOL_STATUS_MARKER) as ToolStatus[]).find(
    (s) => TOOL_STATUS_MARKER[s] === marker
  );
  return { status: status ?? "ok", text: raw.slice(match[0].length) };
}

/** Un statut interdit formellement de prétendre que l'action a eu lieu. */
export function isFailedStatus(status: ToolStatus): boolean {
  return status === "error" || status === "blocked";
}

/**
 * Règle injectée au modèle quand un outil n'a pas abouti. Le marqueur `[...]`
 * est la source de vérité : il ne dépend pas de la formulation du texte.
 */
export const TOOL_HONESTY_RULE =
  "Chaque resultat d'outil commence par un statut entre crochets : [OK] " +
  "l'action a reellement abouti, [ERREUR] elle a echoue, [BLOQUE] elle attend " +
  "la confirmation de l'utilisateur, [VIDE] la source repond mais ne contient " +
  "rien. Ne declare JAMAIS une action realisee (rappel cree, email envoye, " +
  "evenement cree...) si le statut n'est pas [OK]. Pour [ERREUR], dis que " +
  "l'action n'a PAS eu lieu et explique pourquoi. Pour [BLOQUE], dis que tu " +
  "attends sa confirmation. Pour [VIDE], dis qu'il n'y a rien, sans inventer.";
