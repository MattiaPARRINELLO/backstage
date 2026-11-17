import { NextResponse } from "next/server";

import { getSession } from "@/lib/session";
import { listPendingReminders } from "@/modules/reminders";

export async function GET() {
  // Route publique (pollée par le service worker) : sans session active, on
  // ne fuite aucune donnée personnelle — on renvoie une liste vide plutôt
  // qu'un 401 pour ne pas casser le polling du SW en arrière-plan.
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { reminders: [] },
      { headers: { "sw-cached-at": new Date().toISOString() } }
    );
  }

  return NextResponse.json(
    { reminders: await listPendingReminders() },
    { headers: { "sw-cached-at": new Date().toISOString() } }
  );
}
