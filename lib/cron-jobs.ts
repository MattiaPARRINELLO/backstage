/**
 * Jobs declares par les modules, vus depuis le script de planification.
 *
 * Le script ne connait aucun nom de job : il demande `GET /api/cron` au noyau,
 * qui n'expose que les jobs des modules actives. Ces fonctions restent pures
 * pour que le listing et le refus d'un job inconnu se testent sans reseau.
 */

export interface CronJobInfo {
  readonly id: string;
  readonly cron: string;
  readonly moduleId: string;
}

/** Valide la reponse de `GET /api/cron` avant de l'utiliser. */
export function parseCronJobs(payload: unknown): CronJobInfo[] {
  if (!Array.isArray(payload)) {
    throw new Error("Reponse /api/cron invalide : liste attendue.");
  }
  return payload.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new Error("Reponse /api/cron invalide : entree non objet.");
    }
    const { id, cron, moduleId } = entry as Record<string, unknown>;
    if (
      typeof id !== "string" ||
      typeof cron !== "string" ||
      typeof moduleId !== "string"
    ) {
      throw new Error(
        "Reponse /api/cron invalide : id, cron et moduleId doivent etre des chaines."
      );
    }
    return { id, cron, moduleId };
  });
}

/** Job demande, ou erreur qui liste les jobs reellement disponibles. */
export function requireCronJob(jobs: readonly CronJobInfo[], id: string): CronJobInfo {
  const job = jobs.find((entry) => entry.id === id);
  if (!job) {
    const available = jobs.map((entry) => entry.id).join(", ") || "aucun";
    throw new Error(`Job "${id}" inconnu. Jobs disponibles : ${available}.`);
  }
  return job;
}

/** Une ligne de crontab par job, pretes a coller dans cPanel. */
export function crontabLines(
  jobs: readonly CronJobInfo[],
  baseUrl: string
): string[] {
  const base = baseUrl.replace(/\/+$/, "");
  return jobs.map(
    (job) =>
      `${job.cron} curl -fsS -X POST -H "x-cron-secret: $CRON_SECRET" ${base}/api/cron/${job.id} >/dev/null`
  );
}
