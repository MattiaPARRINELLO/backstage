import type { StreamEvent } from "./ai-providers/types";

// Outil exposé dans un instantané de génération en cours (même forme que
// `ToolCall` côté client, dupliquée ici pour rester importable côté client
// sans tirer le code serveur du registre).
export interface ChatRunTool {
  id: string;
  name: string;
  arguments?: string;
  result?: string;
  status: "running" | "success" | "error";
  duration?: number;
  resultCount?: number;
}

// Évènement synthétique envoyé à un client qui se réattache à une génération
// déjà en cours (navigation, fermeture puis réouverture d'onglet). Il contient
// de quoi reconstruire l'état affiché sans rejouer tous les deltas.
export interface ChatRunSnapshotEvent {
  type: "snapshot";
  sessionId: string;
  content: string;
  tools: ChatRunTool[];
  activeTools: ChatRunTool[];
  groups: {
    id: string;
    summary: string;
    tools: { toolCallId: string; name: string; arguments: string }[];
  }[];
  error: string | null;
  finished: boolean;
  doneContent?: string;
}

export type ChatTransportEvent = StreamEvent | ChatRunSnapshotEvent;
