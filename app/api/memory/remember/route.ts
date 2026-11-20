import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addMemoryFact, findSimilarMemoryFacts, logActivity } from "@/lib/storage";
import { AppError } from "@/lib/errors";
import { authedRoute } from "@/lib/route";
import { hasNewInformation } from "@/lib/memory-dedup";

const bodySchema = z.object({
  content: z.string().trim().min(1, "Le contenu est requis").max(500),
  category: z.enum(["dev", "photo", "life", "preference"]),
  confidence: z.number().min(0).max(1).optional(),
});

export const POST = authedRoute(async (_session, request: NextRequest) => {
  const raw = await request.json();
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    throw new AppError("validation", parsed.error.issues[0]?.message ?? "Payload invalide");
  }

  const { content, category, confidence } = parsed.data;

  const existing = await findSimilarMemoryFacts(content, category);
  // Un fait enrichi (nom propre, chiffre, URL absent) n'est pas un doublon :
  // le perdre ferait perdre l'information que le client voulait enregistrer.
  if (existing && !hasNewInformation(content, existing.content)) {
    return NextResponse.json({ fact: existing, alreadyExisted: true });
  }

  const fact = await addMemoryFact(content, category, {
    source: "tool",
    confidence,
  });

  await logActivity("memory_added", `Mémorisé : ${content.slice(0, 80)}`, category);

  return NextResponse.json({ fact, alreadyExisted: false });
});
