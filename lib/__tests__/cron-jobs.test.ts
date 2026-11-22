import { describe, expect, it } from "vitest";

import {
  crontabLines,
  parseCronJobs,
  requireCronJob,
  type CronJobInfo,
} from "@/lib/cron-jobs";

const jobs: CronJobInfo[] = [
  { id: "reminders", cron: "* * * * *", moduleId: "reminders" },
  { id: "daily-brief", cron: "0 7 * * *", moduleId: "daily-brief" },
];

describe("parseCronJobs", () => {
  it("accepte la reponse de GET /api/cron", () => {
    expect(parseCronJobs(jobs)).toEqual(jobs);
  });

  it("refuse une reponse qui n'est pas une liste", () => {
    expect(() => parseCronJobs({ jobs })).toThrow(/liste attendue/);
  });

  it("refuse une entree sans id, cron ou moduleId", () => {
    expect(() => parseCronJobs([{ id: "x", cron: "* * * * *" }])).toThrow(
      /id, cron et moduleId/
    );
  });
});

describe("requireCronJob", () => {
  it("retourne le job demande", () => {
    expect(requireCronJob(jobs, "daily-brief").moduleId).toBe("daily-brief");
  });

  it("refuse un job inconnu en listant les jobs disponibles", () => {
    expect(() => requireCronJob(jobs, "inconnu")).toThrow(
      /Job "inconnu" inconnu.*reminders.*daily-brief/
    );
  });
});

describe("crontabLines", () => {
  it("produit une ligne par job avec son cron et son identifiant", () => {
    expect(crontabLines(jobs, "https://backstage.example/")).toEqual([
      '* * * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://backstage.example/api/cron/reminders >/dev/null',
      '0 7 * * * curl -s -H "x-cron-secret: $CRON_SECRET" https://backstage.example/api/cron/daily-brief >/dev/null',
    ]);
  });
});
