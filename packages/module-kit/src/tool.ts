import type { z } from "zod";

import type { ModuleContext } from "./context";

/**
 * Effet de bord déclaré d'un outil, et non plus listé dans un `Set` séparé.
 *
 * - `none` : aucun effet, aucune lecture de données utilisateur.
 * - `read` : lit des données (locales ou distantes).
 * - `write` : écrit des données que l'utilisateur peut perdre.
 * - `external` : agit hors de l'application (envoi d'email, calendrier, issue).
 */
export type SideEffect = "none" | "read" | "write" | "external";

/**
 * Fiabilité du texte renvoyé.
 *
 * `untrusted` : le résultat contient du contenu tiers (page web, email, issue)
 * qu'un auteur malveillant peut rédiger. Lire un tel outil contamine le tour :
 * toute écriture qui suit doit être confirmée.
 */
export type TrustLevel = "trusted" | "untrusted";

/**
 * Résultat normalisé d'un outil. Le statut est porté par la donnée, plus deviné
 * à partir de la formulation du texte : un outil qui échoue ne peut plus être
 * présenté au modèle comme un succès.
 */
export type ToolStatus = "ok" | "error" | "empty";

export interface ToolOutput {
  readonly status: ToolStatus;
  readonly text: string;
}

export function toolOk(text: string): ToolOutput {
  return { status: "ok", text };
}

export function toolError(text: string): ToolOutput {
  return { status: "error", text };
}

/**
 * Résultat nominal mais vide : la source répond, il n'y a simplement rien.
 * Ce n'est pas un échec, mais ce n'est pas un succès exploitable : la règle
 * d'honnêteté interdit de le combler par une invention.
 */
export function toolEmpty(text: string): ToolOutput {
  return { status: "empty", text };
}

export type ToolContext = ModuleContext;

export interface ToolDefinition<Schema extends z.ZodType = z.ZodType> {
  /** Nom court, namespace par le module : `add` devient `reminders.add`. */
  readonly name: string;
  /** Description longue, destinée au prompt du modèle. */
  readonly description: string;
  /** Schéma des arguments. La validation appartient au noyau, pas au module. */
  readonly params: Schema;
  readonly sideEffect: SideEffect;
  /** Par défaut `trusted`. Voir `TrustLevel`. */
  readonly trust?: TrustLevel;
  /**
   * Surcharge explicite de la confirmation. Absent, la valeur est dérivée :
   * `external` exige une confirmation, les autres effets non.
   */
  readonly requiresConfirmation?: boolean;
  /** Libellé d'une action en attente, affiché tel quel à l'utilisateur. */
  readonly describeAction?: (args: z.infer<Schema>) => string;
  readonly run: (
    args: z.infer<Schema>,
    ctx: ToolContext
  ) => Promise<ToolOutput>;
}

export type AnyToolDefinition = ToolDefinition<z.ZodType>;

/**
 * Déclare un outil. Identité à l'exécution : c'est le typage qui vérifie que
 * `params` et `run` parlent du même schéma, et que l'effet est déclaré.
 */
export function defineTool<Schema extends z.ZodType>(
  definition: ToolDefinition<Schema>
): ToolDefinition<Schema> {
  return definition;
}

/** Partie d'un outil qui décide de la politique de confirmation. */
export interface PolicySubject {
  readonly sideEffect: SideEffect;
  readonly requiresConfirmation?: boolean;
  readonly trust?: TrustLevel;
}

/**
 * Un outil exige-t-il la confirmation de l'utilisateur ?
 *
 * `external` l'exige par défaut. Seul un module peut retirer cette exigence,
 * explicitement, en déclarant `requiresConfirmation: false` : le noyau ne
 * désactive jamais la confirmation à la place du module.
 */
export function requiresConfirmation(tool: PolicySubject): boolean {
  return tool.requiresConfirmation ?? tool.sideEffect === "external";
}

/**
 * Une confirmation utilisateur peut-elle réellement débloquer cet outil ?
 * C'est le pendant de ce que le registre d'actions en attente accepte.
 *
 * `write` et `external` sont confirmables **par provenance** (ADR 0001,
 * décision D), même quand le module a retiré la confirmation permanente :
 * un outil externe bloqué par un contenu tiers doit rester déblocable.
 */
export function isConfirmable(tool: PolicySubject): boolean {
  return tool.sideEffect === "write" || tool.sideEffect === "external";
}

/** Le résultat de l'outil peut-il contenir du contenu tiers ? */
export function isUntrusted(tool: PolicySubject): boolean {
  return (tool.trust ?? "trusted") === "untrusted";
}

/** Nom complet d'un outil dans le registre : `reminders.add`. */
export function qualifiedName(moduleId: string, toolName: string): string {
  return `${moduleId}.${toolName}`;
}
