import { NextRequest, NextResponse } from "next/server";

import { requireSession } from "@/lib/session";
import { snoozeReminder } from "@/modules/reminders";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSession();
  } catch {
    return NextResponse.json({ error: "Non authentifié" }, { status: 401 });
  }

  const { id } = await params;
  const ok = await snoozeReminder(id);
  if (!ok) return NextResponse.json({ error: "Rappel introuvable" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
