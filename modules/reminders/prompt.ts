import type { PromptContribution } from "@backstage/module-kit";

import { getReminders } from "@/lib/storage";

/**
 * Bloc « rappels en attente » du prompt systeme.
 *
 * Reprend a l'identique le bloc qui vivait dans `lib/chat-prompts.ts` : le
 * noyau ne connait plus les rappels, il ordonne et borne le rendu (ADR 0001,
 * decision F). Seuls les cinq prochains rappels pending sont cites.
 */
export const upcomingRemindersPrompt: PromptContribution = {
  id: "upcoming",
  priority: 50,
  render: async () => {
    const { reminders } = await getReminders();
    const pending = reminders
      .filter((reminder) => reminder.status === "pending")
      .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime())
      .slice(0, 5);

    if (pending.length === 0) return "";

    return (
      "Rappels en attente :\n" +
      pending
        .map(
          (reminder) =>
            `- ${reminder.title} (échéant le ${new Date(reminder.dueAt).toLocaleDateString("fr-FR")})`
        )
        .join("\n")
    );
  },
};
