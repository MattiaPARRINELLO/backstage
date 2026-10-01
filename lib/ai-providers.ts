// Barrel : surface publique historique du module ai-providers.
// Les adapteurs OpenAI/Anthropic vivent dans ai-providers/{openai,anthropic}.ts.
import type { ChatCompletionResult, StreamEvent, UnifiedMessage, UnifiedTool } from "./ai-providers/types";
import { isAnthropicModel } from "./ai-providers/config";
import { chatOpenAI, responsesOpenAI, streamOpenAI } from "./ai-providers/openai";
import { chatAnthropic, streamAnthropic } from "./ai-providers/anthropic";

export type { UnifiedMessage, UnifiedTool, UnifiedToolCall, ChatCompletionResult, StreamEvent } from "./ai-providers/types";

// Un modèle peut refuser chat.completions au profit de l'API Responses :
// on bascule automatiquement plutot que de tenir une liste de modèles à jour.
function isProtocolUnsupported(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /ModelProtocolUnsupported|does not support this protocol/i.test(message);
}

export async function chatCompletion(
  model: string,
  messages: UnifiedMessage[],
  tools: UnifiedTool[],
  signal?: AbortSignal,
  sessionId?: string
): Promise<ChatCompletionResult> {
  if (isAnthropicModel(model)) {
    return chatAnthropic(model, messages, tools, signal, sessionId);
  }
  try {
    return await chatOpenAI(model, messages, tools, signal, sessionId);
  } catch (err) {
    if (tools.length > 0 || !isProtocolUnsupported(err)) throw err;
    return responsesOpenAI(model, messages, signal, sessionId);
  }
}

export async function* streamChatCompletion(
  model: string,
  messages: UnifiedMessage[],
  tools: UnifiedTool[],
  signal?: AbortSignal,
  sessionId?: string
): AsyncGenerator<StreamEvent> {
  if (isAnthropicModel(model)) {
    return yield* streamAnthropic(model, messages, tools, signal, sessionId);
  }
  return yield* streamOpenAI(model, messages, tools, signal, sessionId);
}
