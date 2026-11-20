"use server";

import { z } from "zod";

import { actionInput } from "@/lib/action";
import { getActivity } from "@/lib/storage";
import type { ActivityEntry } from "@/lib/types";

const limitInput = z.number().int().min(1).max(500);

export async function loadActivity(limit = 50): Promise<ActivityEntry[]> {
  const { data } = await actionInput(limitInput, limit);
  return getActivity(data);
}
