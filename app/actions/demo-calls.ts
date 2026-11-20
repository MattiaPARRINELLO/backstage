"use server";

import { z } from "zod";

import { actionInput } from "@/lib/action";
import { getDemoCalls } from "@/lib/storage";
import type { DemoCallEntry } from "@/lib/types";

const limitInput = z.number().int().min(1).max(5000);

export async function loadDemoCalls(limit = 1000): Promise<DemoCallEntry[]> {
  const { data } = await actionInput(limitInput, limit);
  return getDemoCalls(data);
}
