"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";

import { actionInput } from "@/lib/action";
import { getFocusState, startFocus, stopFocus, type FocusState } from "@/lib/focus";

const emptyInput = z.object({});
const durationInput = z.number().int().min(1).max(240);

export async function loadFocus(): Promise<FocusState> {
  await actionInput(emptyInput, {});
  return getFocusState();
}

export async function startFocusSession(durationMin: number): Promise<FocusState> {
  const { data } = await actionInput(durationInput, durationMin);
  const state = await startFocus(data);
  revalidatePath("/focus");
  return state;
}

export async function stopFocusSession(): Promise<FocusState> {
  await actionInput(emptyInput, {});
  const state = await stopFocus();
  revalidatePath("/focus");
  return state;
}
