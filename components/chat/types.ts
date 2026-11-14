type Role = "user" | "assistant";

// Une étape du fil d'activité d'un tour assistant : une pensée du modèle ou un
// appel d'outil, dans l'ordre réel de la génération.
export type ActivityStep =
  | { kind: "thought"; text: string }
  | {
      kind: "tool";
      id: string;
      name: string;
      arguments?: string;
      result?: string;
      status: "running" | "success" | "error";
      duration?: number;
      resultCount?: number;
    };

export type Message = {
  id: string;
  role: Role;
  content: string;
  timestamp: string;
  toolCalls?: ToolCall[];
  steps?: ActivityStep[];
  // Durée totale du tour, en millisecondes (affichée dans l'en-tête du fil).
  activityMs?: number;
};

export type ToolCall = {
  id: string;
  name: string;
  arguments?: string;
  result?: string;
  status: "running" | "success" | "error";
  duration?: number;
  resultCount?: number;
};
