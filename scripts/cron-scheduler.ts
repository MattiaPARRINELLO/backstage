import {
  crontabLines,
  parseCronJobs,
  requireCronJob,
  type CronJobInfo,
} from "../lib/cron-jobs";

const args = process.argv.slice(2);
const job = args[0];

const BASE_URL = process.env.CRON_BASE_URL || "http://localhost:3000";
const CRON_SECRET = process.env.CRON_SECRET;

function headers(): Record<string, string> {
  const value: Record<string, string> = { "Content-Type": "application/json" };
  if (CRON_SECRET) value["x-cron-secret"] = CRON_SECRET;
  return value;
}

async function fetchJobs(): Promise<CronJobInfo[]> {
  const res = await fetch(`${BASE_URL}/api/cron`, { headers: headers() });
  if (!res.ok) {
    throw new Error(`GET /api/cron a echoue (HTTP ${res.status}).`);
  }
  return parseCronJobs(await res.json());
}

function printUsage(jobs: readonly CronJobInfo[]): void {
  console.error("Usage: bun scripts/cron-scheduler.ts <job>");
  console.error("       bun scripts/cron-scheduler.ts --list");
  console.error(
    `Jobs disponibles : ${
      jobs.map((entry) => `${entry.id} (${entry.cron})`).join(", ") || "aucun"
    }`
  );
}

async function main() {
  if (!job || job === "--help") {
    printUsage(await fetchJobs());
    process.exit(1);
  }

  const jobs = await fetchJobs();

  if (job === "--list") {
    console.log(crontabLines(jobs, BASE_URL).join("\n"));
    return;
  }

  const entry = requireCronJob(jobs, job);
  const url = `${BASE_URL}/api/cron/${entry.id}`;

  console.log(`[cron] Appel ${url}...`);
  const res = await fetch(url, { method: "POST", headers: headers() });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[cron] Échec HTTP ${res.status}: ${body}`);
    process.exit(1);
  }

  const data = await res.json();
  console.log(`[cron] OK:`, data);
}

main().catch((err) => {
  console.error("[cron] Erreur:", err instanceof Error ? err.message : err);
  process.exit(1);
});
