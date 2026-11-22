import { NextResponse } from "next/server";

import { isAuthorizedCron } from "@/lib/cron-auth";
import { registry } from "@/lib/kernel/registry";

/**
 * Liste des jobs des modules actives, pour le script de planification.
 * Aucun nom de job n'est code en dur : ajouter un job ne touche pas ce fichier.
 */
export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  return NextResponse.json(
    registry.jobs.map((entry) => ({
      id: entry.job.id,
      cron: entry.job.cron,
      moduleId: entry.moduleId,
    }))
  );
}
