import {
  classifyToolText,
  SIDE_EFFECT_TOOL_NAMES,
  TOOL_STATUS_MARKER,
  type ToolStatus,
} from "@/lib/tool-result";

/**
 * Un appel d'outil tel qu'il apparaît dans un message (client ou historique).
 * Volontairement structurel : le module ne dépend ni de React ni d'un type client.
 */
export interface ActionContextToolCall {
  id: string;
  name: string;
  arguments?: string;
  result?: string;
  status?: "running" | "success" | "error";
}

interface ActionContextMessage {
  role?: string;
  content?: string;
  toolCalls?: ActionContextToolCall[];
}

function actionKey(tc: ActionContextToolCall): string {
  return `${tc.name}:${tc.arguments ?? ""}`;
}

/**
 * Statut affiché d'une action. La confirmation serveur fait foi : un texte de
 * blocage n'est plus retenu comme état courant dès que la même action porte un
 * résultat exécuté. Un `[VIDE]` (dédoublonnage) reste un aboutissement, pas un
 * blocage.
 */
function displayedStatus(tc: ActionContextToolCall): ToolStatus {
  const parsed = classifyToolText(tc.result ?? "");
  if (parsed === "blocked") return "blocked";
  if (tc.status === "error") return "error";
  return parsed;
}

/**
 * Construit le bloc `<executed_actions>` rejoué au modèle dans les tours
 * suivants.
 *
 * Deux garanties, apprises de l'issue #141 :
 * 1. une seule ligne par action (nom + arguments) : le dernier état connu, donc
 *    l'état serveur après confirmation, remplace un ancien `[BLOQUE]` ;
 * 2. le statut se déduit du résultat, jamais de la seule position historique.
 */
export function buildActionContext(messages: ActionContextMessage[]): string {
  const latest = new Map<string, ActionContextToolCall>();
  for (const message of messages) {
    for (const tc of message.toolCalls ?? []) {
      if (!SIDE_EFFECT_TOOL_NAMES.has(tc.name)) continue;
      if (!tc.result || tc.status === "running") continue;
      latest.set(actionKey(tc), tc);
    }
  }

  return [...latest.values()]
    .slice(-20)
    .map((tc) => {
      const status = displayedStatus(tc);
      const result = (tc.result ?? "").replace(/\s+/g, " ").trim().slice(0, 220);
      return `- ${tc.name} : [${TOOL_STATUS_MARKER[status]}] ${result}`;
    })
    .join("\n");
}
