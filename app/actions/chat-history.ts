"use server";

import { z } from "zod";

import { actionInput } from "@/lib/action";
import { getChatHistory as storageGetChatHistory, saveChatSession as storageSaveChatSession, deleteChatSession as storageDeleteChatSession } from "@/lib/storage";
import type { ChatSession } from "@/lib/types";

const emptyInput = z.object({});
const idInput = z.string().min(1, "Identifiant requis");
const contentInput = z.string().min(1, "Contenu requis").max(20_000);

// `passthrough` : les champs du fil (outils, étapes, compteurs) traversent la
// validation sans être connus du schéma, donc sans être perdus à l'écriture.
const messageSchema = z
  .object({
    id: z.string().min(1),
    role: z.enum(["user", "assistant"]),
    content: z.string(),
    timestamp: z.string(),
  })
  .passthrough();

const chatSessionSchema = z
  .object({
    id: z.string().min(1),
    title: z.string(),
    messages: z.array(messageSchema).max(2000),
    createdAt: z.string(),
    updatedAt: z.string(),
    context: z.enum(["code", "photo", "general"]).optional(),
  })
  .passthrough();

export async function getChatHistory() {
  await actionInput(emptyInput, {});
  return storageGetChatHistory();
}

export async function saveChatSession(session: ChatSession) {
  const { data } = await actionInput(chatSessionSchema, session);
  return storageSaveChatSession(data as ChatSession);
}

export async function deleteChatSession(id: string) {
  const { data } = await actionInput(idInput, id);
  return storageDeleteChatSession(data);
}

export async function generateConversationTitle(content: string): Promise<string> {
  const { data } = await actionInput(contentInput, content);
  const { chatCompletion } = await import("@/lib/ai-providers");
  const { getTitleModel } = await import("@/lib/app-config");
  const model = await getTitleModel();

  const prompt = `Génère un titre très court (3-6 mots) pour cette conversation. Réponds UNIQUEMENT par le titre, sans guillemets ni préambule.

Message : "${data.slice(0, 500)}"`;

  try {
    const result = await chatCompletion(model, [
      { role: "user", content: prompt },
    ], []);
    const title = result.content.trim().replace(/^["']|["']$/g, "");
    if (title && title.length <= 80) return title;
  } catch (err) {
    console.error("Title generation failed:", err);
  }

  const cleaned = data.replace(/\s+/g, " ").trim();
  return cleaned.length <= 50 ? cleaned : cleaned.slice(0, 50).replace(/\s\S*$/, "") + "…";
}
