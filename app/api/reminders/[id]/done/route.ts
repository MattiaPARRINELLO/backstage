import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { getSession } from "@/lib/session";
import { completeReminder } from "@/modules/reminders";

// Marque un rappel « fait ». Appelé par le service worker (notification push)
// et l'UI. La règle vit dans le module ; cette route ne fait que traduire.
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  const ok = await completeReminder(id);
  if (!ok) return NextResponse.json({ error: "Rappel introuvable" }, { status: 404 });

  revalidatePath("/reminders");
  return NextResponse.json({ ok: true });
}
