import { NextRequest, NextResponse } from "next/server";

import { AppError } from "@/lib/errors";
import { authedRoute } from "@/lib/route";
import { recurReminder } from "@/modules/reminders";

export const POST = authedRoute(
  async (_session, _request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const result = await recurReminder(id);

    if (!result.ok) {
      // La règle « pas de récurrence » n'est pas une erreur de transport : le
      // client affiche le motif. Un identifiant inconnu reste un 404.
      if (result.reason === "Rappel introuvable") {
        throw new AppError("not_found", result.reason);
      }
      return NextResponse.json({ ok: false, reason: result.reason });
    }

    return NextResponse.json({ ok: true, nextDue: result.nextDue });
  }
);
