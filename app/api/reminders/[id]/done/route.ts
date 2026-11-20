import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { AppError } from "@/lib/errors";
import { authedRoute } from "@/lib/route";
import { completeReminder } from "@/modules/reminders";

// Marque un rappel « fait ». Appelé par le service worker (notification push)
// et l'UI. La règle vit dans le module ; cette route ne fait que traduire.
export const POST = authedRoute(
  async (_session, _request: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const ok = await completeReminder(id);
    if (!ok) throw new AppError("not_found", "Rappel introuvable");

    revalidatePath("/reminders");
    return NextResponse.json({ ok: true });
  }
);
