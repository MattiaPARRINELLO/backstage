import { NextRequest, NextResponse } from "next/server";

import { AppError } from "@/lib/errors";
import { authedRoute } from "@/lib/route";
import { snoozeReminder } from "@/modules/reminders";

export const POST = authedRoute(
  async (_session, _request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const ok = await snoozeReminder(id);
    if (!ok) throw new AppError("not_found", "Rappel introuvable");

    return NextResponse.json({ ok: true });
  }
);
