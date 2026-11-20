// ============================================================
// Ce que la landing tient ensemble : les six domaines.
// ============================================================

export type ModuleItem = {
  name: string;
  /** Deux ou trois mots, pour l'index du premier ecran. */
  short: string;
  line: string;
};

export const MODULES = {
  title: "Ce qu'il tient ensemble.",
  lead: "Six domaines, un seul espace. Chaque bloc correspond à un écran qui existe déjà dans l'application.",
  items: [
    {
      name: "Mails",
      short: "Boîte résumée",
      line: "La boîte Gmail résumée dans la conversation, sans changer d'onglet.",
    },
    {
      name: "Agenda",
      short: "Cours, rappels",
      line: "Une seule ligne de temps, groupée par jour, avec un bloc pour ce qui est en retard.",
    },
    {
      name: "Mémoire",
      short: "Faits éditables",
      line: "Ce que l'IA a retenu, fait par fait : chaque ligne est modifiable et supprimable.",
    },
    {
      name: "Shootings",
      short: "Shoot → livraison",
      line: "Salles, accréditations, contacts et séries, du jour du shoot à la livraison.",
    },
    {
      name: "Code",
      short: "Un problème par jour",
      line: "Un problème quotidien, et une aide qui connaît déjà votre niveau et vos objectifs.",
    },
    {
      name: "Chez vous",
      short: "Fichiers locaux",
      line: "Les données vivent dans un dossier local. Pas de compte à créer chez un tiers.",
    },
  ] satisfies ModuleItem[],
} as const;
