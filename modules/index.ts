import type { ModuleDefinition } from "@backstage/module-kit";

import reminders from "./reminders/module";
import schedule from "./schedule/module";

/**
 * Racine de composition.
 *
 * C'est le seul endroit du dépôt qui nomme des modules. Ajouter une capacité
 * consiste à écrire son dossier, l'ajouter ici, et l'activer dans
 * `modules.config.json` — aucune modification du noyau.
 */
export const modules: readonly ModuleDefinition[] = [reminders, schedule];
