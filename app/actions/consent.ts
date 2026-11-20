"use server";

import { z } from "zod";

import { runAction } from "@/lib/action";
import { getAiConsent, setAiConsent, type ConsentState } from "@/lib/consent";

const emptyInput = z.object({});
const acceptedInput = z.boolean();

export async function loadAiConsent(): Promise<ConsentState> {
  return runAction(emptyInput, {}, async () => getAiConsent(), "loadAiConsent");
}

export async function acceptAiConsent(accepted: boolean): Promise<ConsentState> {
  return runAction(
    acceptedInput,
    accepted,
    async (value) => setAiConsent(value),
    "acceptAiConsent"
  );
}
