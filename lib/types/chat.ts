/**
 * Message entrant tel que valide par le schema de `POST /api/chat` : `content`
 * peut manquer (message assistant porteur d'appels d'outils, par exemple).
 */
export interface ChatRequestMessage {
  role: "system" | "user" | "assistant";
  content?: string;
  toolCalls?: { id: string; name: string; arguments: string }[];
}

export interface ChatMessage extends ChatRequestMessage {
  content: string;
}

interface ChatSessionMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  toolCalls?: {
    id: string;
    name: string;
    arguments?: string;
    result?: string;
    status?: "running" | "success" | "error";
    duration?: number;
    resultCount?: number;
  }[];
  // Fil d'activité du tour (pensées + outils), dans l'ordre de génération.
  steps?: (
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
      }
  )[];
  activityMs?: number;
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatSessionMessage[];
  createdAt: string;
  updatedAt: string;
  context?: "code" | "photo" | "general";
}

export interface ChatHistory {
  sessions: ChatSession[];
}
