import { NextResponse } from "next/server";

import { isAuthorizedCron } from "@/lib/cron-auth";
import { createModuleContext } from "@/lib/kernel/context";
import { registry } from "@/lib/kernel/registry";
import { serverLog } from "@/lib/logger";

/**
 * Route unique des jobs declares par les modules (ADR 0001, decision I).
 *
 * L'identifiant du job est global : le registre refuse deux modules actives qui
 * declarent le meme. Un job inconnu ou appartenant a un module desactive n'est
 * pas dans `registry.jobs`, donc repond 404.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ job: string }> }
) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { job: jobId } = await params;
  const entry = registry.job(jobId);
  if (!entry) {
    return NextResponse.json({ error: "Job inconnu" }, { status: 404 });
  }

  try {
    await entry.job.handler(createModuleContext(entry.moduleId));
    return NextResponse.json({ success: true });
  } catch (err) {
    void serverLog(`cron/${jobId}`, "error", "Echec du job", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
