/**
 * Version du contrat que ce noyau sait exécuter.
 *
 * Elle s'incrémente à chaque rupture du contrat (`ModuleDefinition`,
 * `ToolDefinition`, `ActionDefinition`). Un module qui déclare une version
 * supérieure est refusé au chargement, avec un message actionnable : mieux vaut
 * un refus explicite qu'un plantage au premier appel d'outil.
 */
export const KERNEL_API = 1;
