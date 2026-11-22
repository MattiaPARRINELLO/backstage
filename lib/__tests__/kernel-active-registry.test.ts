import { describe, expect, it } from "vitest";

/**
 * Le registre actif est construit depuis `modules/index.ts` et
 * `modules.config.json`. Ce test vérifie le câblage réel, pas la logique du
 * registre (couverte par `kernel-registry.test.ts`).
 */
const { registry } = await import("@/lib/kernel/registry");

describe("registre actif", () => {
  it("charge les modules listes dans la racine de composition", () => {
    expect(registry.modules.map((definition) => definition.id)).toEqual([
      "accreditations",
      "calendar",
      "concerts",
      "daily-brief",
      "emails",
      "followups",
      "github",
      "photo",
      "reminders",
      "schedule",
      "watch-later",
      "weather",
      "web",
    ]);
  });

  it("n'expose que les modules actives dans modules.config.json", () => {
    expect(registry.enabled.map((definition) => definition.id)).toEqual([
      "accreditations",
      "calendar",
      "concerts",
      "daily-brief",
      "emails",
      "followups",
      "github",
      "photo",
      "reminders",
      "schedule",
      "watch-later",
      "weather",
      "web",
    ]);
  });

  it("expose les outils du module sous leur nom qualifie", () => {
    expect(registry.tools.map((tool) => tool.name)).toEqual([
      "accreditations.scan",
      "calendar.create",
      "calendar.delete",
      "calendar.search",
      "calendar.update",
      "concerts.list",
      "concerts.prepare",
      "emails.reply",
      "emails.search",
      "emails.triage",
      "followups.schedule",
      "github.create_issue",
      "github.list_issues",
      "photo.add",
      "photo.list",
      "photo.update",
      "reminders.add",
      "reminders.list",
      "reminders.update",
      "schedule.get",
      "watch-later.add",
      "weather.get",
      "web.page_meta",
      "web.search",
    ]);
  });

  it("derive la confirmation du contrat, sans liste", () => {
    expect(registry.requireTool("reminders.add").confirmable).toBe(true);
    expect(registry.requireTool("reminders.add").requiresConfirmation).toBe(false);
    expect(registry.requireTool("reminders.list").confirmable).toBe(false);
  });

  it("expose les jobs declares par les modules actives", () => {
    expect(registry.jobs.map((entry) => `${entry.moduleId}.${entry.job.id}`)).toEqual([
      "daily-brief.daily-brief",
      "reminders.reminders",
      "schedule.schedule-notifications",
    ]);
  });
});
