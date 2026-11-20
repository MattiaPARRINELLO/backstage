"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { actionInput } from "@/lib/action";
import { resolveIntention, getIntentions } from "@/lib/storage";

const emptyInput = z.object({});
const idInput = z.string().min(1, "Identifiant requis");

export async function cancelIntention(id: string): Promise<boolean> {
  const { data } = await actionInput(idInput, id);
  const ok = await resolveIntention(data, "cancelled");
  revalidatePath("/week");
  return ok;
}

export async function loadIntentions() {
  await actionInput(emptyInput, {});
  return getIntentions();
}
