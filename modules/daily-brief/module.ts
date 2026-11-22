import { defineModule } from "@backstage/module-kit";

/**
 * Module Brief du jour.
 *
 * Il ne porte qu'un job : la generation et l'envoi restent dans le noyau
 * (`lib/notification-daily-brief.ts`), comme pour les rappels. Declarer ce job
 * ici evite d'ajouter un cas particulier dans la route `/api/cron/[job]`.
 */
export default defineModule({
  id: "daily-brief",
  apiVersion: 1,
  version: "1.0.0",
  label: "Brief du jour",
  selectionDescription: "Envoi du brief quotidien.",
  description:
    "Genere et pousse le brief du jour une fois par jour, avec anti-doublon " +
    "entre le scheduler interne et le cron.",
  dependencies: [],
  jobs: [
    {
      id: "daily-brief",
      // Fenetre d'une heure plutot que la seule minute 7:00 : un tick en
      // retard ou un redemarrage a 7:01 ne doit pas perdre le brief du jour.
      // L'anti-doublon de `triggerDailyBrief` garantit un seul envoi.
      cron: "* 7 * * *",
      handler: async () => {
        const { triggerDailyBrief } = await import("@/lib/notification-scheduler");
        // Le contexte de module ne porte pas la requete : l'IP d'origine du
        // cron n'est plus journalisee dans le detail d'activite.
        await triggerDailyBrief("cron");
      },
    },
  ],
});
