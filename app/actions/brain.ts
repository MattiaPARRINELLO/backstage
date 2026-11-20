"use server";

import { hasNewInformation } from "@/lib/memory-dedup";

import { actionInput } from "@/lib/action";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  addMemoryFact,
  deleteMemoryFact,
  findSimilarMemoryFacts,
  getMemory,
  getMemoryRelationships,
  saveMemory,
  touchMemoryFact,
  updateMemoryFact,
  logActivity,
} from "@/lib/storage";
import { persistExtractedFacts } from "@/lib/memory-autosave";
import type { MemoryCategory, MemoryData, MemoryFact, MemoryRelationship, MemorySource } from "@/lib/types";

const memoryCategorySchema = z.enum(["dev", "photo", "life", "preference"]);
const emptyInput = z.object({});
const idInput = z.string().min(1, "Identifiant requis");

const rememberFactSchema = z.object({
  content: z.string().trim().min(1, "Contenu requis"),
  category: memoryCategorySchema,
  source: z.enum(["manual", "tool", "auto-extract"]).optional(),
  confidence: z.number().min(0).max(1).optional(),
});

const autoExtractSchema = z.object({
  facts: z
    .array(
      z.object({
        content: z.string().trim().min(1),
        category: memoryCategorySchema,
        confidence: z.number().min(0).max(1),
      })
    )
    .max(8),
});

const updateMemorySchema = z
  .object({
    content: z.string().trim().min(1).optional(),
    category: memoryCategorySchema.optional(),
  })
  .strict();

const updateProfileSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    preferences: z.array(z.string().trim().min(1)).optional(),
  })
  .strict();

export async function loadBrain(): Promise<MemoryData> {
  await actionInput(emptyInput, {});
  return getMemory();
}

export async function rememberFact(
  content: string,
  category: MemoryCategory,
  options?: { source?: MemorySource; confidence?: number }
): Promise<MemoryFact> {
  const { data: parsed } = await actionInput(rememberFactSchema, { content, category, ...options });
  const existing = await findSimilarMemoryFacts(parsed.content, parsed.category);
  // Un fait enrichi (nom propre, chiffre, URL absent du fait existant) n'est pas
  // un doublon : sans cette garde, l'information nouvelle était perdue en
  // silence et l'UI renvoyait l'ancien fait comme s'il venait d'être ajouté.
  if (existing && !hasNewInformation(parsed.content, existing.content)) {
    await touchMemoryFact(existing.id);
    revalidatePath("/brain");
    return existing;
  }
  const fact = await addMemoryFact(parsed.content, parsed.category, {
    source: parsed.source,
    confidence: parsed.confidence,
  });
  await logActivity("memory_added", `Mémorisé : ${parsed.content.slice(0, 80)}`, parsed.category);
  revalidatePath("/brain");
  return fact;
}

export async function autoExtractMemoryFacts(
  raw: { facts: { content: string; category: MemoryCategory; confidence: number }[] }
): Promise<MemoryFact[]> {
  const { data: parsed } = await actionInput(autoExtractSchema, raw);
  // La persistance est mutualisee avec la route de chat : meme dedoublonnage,
  // meme seuil, meme journalisation (lib/memory-autosave.ts).
  const saved = await persistExtractedFacts(parsed.facts);
  if (saved.length > 0) revalidatePath("/brain");
  return saved;
}

export async function editMemoryFact(
  id: string,
  updates: Partial<Pick<MemoryFact, "content" | "category">>
): Promise<MemoryFact | null> {
  const { data: factId } = await actionInput(idInput, id);
  const { data: parsed } = await actionInput(updateMemorySchema, updates);
  const f = await updateMemoryFact(factId, parsed);
  if (f) await logActivity("memory_updated", `Fait modifié : ${f.content.slice(0, 80)}`);
  revalidatePath("/brain");
  return f;
}

export async function forgetFact(id: string): Promise<boolean> {
  const { data } = await actionInput(idInput, id);
  const ok = await deleteMemoryFact(data);
  if (ok) await logActivity("memory_deleted", "Fait supprimé", data);
  revalidatePath("/brain");
  return ok;
}

export async function loadMemoryRelationships(): Promise<MemoryRelationship[]> {
  await actionInput(emptyInput, {});
  return getMemoryRelationships();
}

export async function updateProfile(input: { name?: string; preferences?: string[] }): Promise<MemoryData> {
  const { data: parsed } = await actionInput(updateProfileSchema, input);
  const data = await getMemory();
  const next: MemoryData = {
    ...data,
    profile: {
      name: parsed.name ?? data.profile.name,
      preferences: parsed.preferences ?? data.profile.preferences,
    },
  };
  await saveMemory(next);
  revalidatePath("/brain");
  return next;
}
