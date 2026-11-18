import type { ModuleDefinition } from "@backstage/module-kit";

import github from "./github/module";
import reminders from "./reminders/module";
import schedule from "./schedule/module";
import watchLater from "./watch-later/module";
import weather from "./weather/module";
import web from "./web/module";

/**
 * Racine de composition.
 *
 * C'est le seul endroit du dépôt qui nomme des modules. Ajouter une capacité
 * consiste à écrire son dossier, l'ajouter ici, et l'activer dans
 * `modules.config.json` — aucune modification du noyau.
 */
export const modules: readonly ModuleDefinition[] = [github, reminders, schedule, watchLater, weather, web];
