"use server";

import { z } from "zod";

import { actionInput } from "@/lib/action";
import { getMemory, addMemoryFact } from "@/lib/storage";
import type { MemoryData, MemoryFact } from "@/lib/types";

const emptyInput = z.object({});

const rememberInput = z.object({
  content: z.string().trim().min(1, "Contenu requis"),
  category: z.enum(["dev", "photo", "life", "preference"]),
});

export async function loadMemory(): Promise<MemoryData> {
  await actionInput(emptyInput, {});
  return getMemory();
}

export async function rememberFact(
  content: string,
  category: MemoryFact["category"]
): Promise<MemoryFact> {
  const { data } = await actionInput(rememberInput, { content, category });
  return addMemoryFact(data.content, data.category);
}
