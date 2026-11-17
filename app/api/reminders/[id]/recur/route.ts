import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/session";
import { recurReminder } from "@/modules/reminders";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  const result = await recurReminder(id);

  if (!result.ok) {
    // La règle « pas de récurrence » n'est pas une erreur de transport : le
    // client affiche le motif. Un identifiant inconnu reste un 404.
    if (result.reason === "Rappel introuvable") {
      return NextResponse.json({ error: result.reason }, { status: 404 });
    }
    return NextResponse.json({ ok: false, reason: result.reason });
  }

  return NextResponse.json({ ok: true, nextDue: result.nextDue });
}
