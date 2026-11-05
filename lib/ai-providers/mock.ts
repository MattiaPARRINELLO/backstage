// Fournisseur IA factice pour le developpement local et les contributions.
//
// Active par `AI_PROVIDER=mock` (voir `.env.example`). Il ne fait AUCUN appel
// reseau et ne touche a aucun secret : les contributions peuvent cloner le
// depot, lancer l'app et discuter dans le chat sans cle API.
//
// Le comportement reste volontairement minimal : texte scripte, aucun appel
// d'outil. Pour tester les outils IA, utiliser un vrai provider.

import type {
  ChatCompletionResult,
  StreamEvent,
  UnifiedMessage,
  UnifiedTool,
} from "./types";

export const MOCK_MODEL = "mock-backstage";
export const MOCK_CODE_MODEL = "mock-backstage-code";

export const MOCK_CATALOG = [
  { id: MOCK_MODEL, protocol: "openai" as const },
  { id: MOCK_CODE_MODEL, protocol: "openai" as const },
];

function lastUserMessage(messages: UnifiedMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message.role === "user" && message.content) return message.content.trim();
  }
  return "";
}

export function mockReply(messages: UnifiedMessage[]): string {
  const prompt = lastUserMessage(messages);
  const extrait = prompt.length > 160 ? `${prompt.slice(0, 160)}...` : prompt;

  return [
    "Mode developpement : reponse factice, aucun appel a un vrai modele.",
    extrait ? `Tu as ecrit : « ${extrait} »` : "",
    "",
    "Cette reponse existe pour tester l'interface, le streaming SSE et la",
    "persistance sans cle API. Pour brancher un vrai provider, retire",
    "`AI_PROVIDER=mock` de `.env.local` et renseigne `NEXT_PUBLIC_API_URL`",
    "et `IA_API_KEY`.",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function chatMock(
  messages: UnifiedMessage[],
  _tools: UnifiedTool[]
): Promise<ChatCompletionResult> {
  return { content: mockReply(messages), toolCalls: [] };
}

export async function* streamMock(
  messages: UnifiedMessage[],
  _tools: UnifiedTool[]
): AsyncGenerator<StreamEvent> {
  const reply = mockReply(messages);

  yield { type: "reasoning", content: "Reponse generee localement (mode mock)." };

  // Decoupage grossier en mots pour imiter un flux reel sans temporisation.
  const chunks = reply.match(/\S+\s*/g) ?? [reply];
  let full = "";
  for (const chunk of chunks) {
    full += chunk;
    yield { type: "delta", content: chunk };
  }

  yield { type: "done", content: full };
}
