/**
 * Helpers de mise en forme des cartes Discord — purs, sans dépendance à
 * next/og, donc testables sous vitest (le rendu WASM, lui, ne l'est pas).
 */

export const CARD_WIDTH = 1100;
export const CARD_PADDING = 44;
export const CONTENT_WIDTH = CARD_WIDTH - CARD_PADDING * 2;

/** Largeur moyenne d'un caractère, en fraction de la taille de police. */
const CHAR_WIDTH_RATIO = 0.52;

/** Les emojis n'ont pas de glyphe dans les polices embarquées (carrés vides). */
export function stripEmoji(value: string): string {
  return value
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/[\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

export function clampText(value: string, max: number): string {
  const clean = stripEmoji(value).replace(/\s*\n\s*/g, " ").trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Nombre de lignes occupées par `text` à la taille de police donnée. */
export function lineCount(text: string, fontSize: number, width = CONTENT_WIDTH): number {
  const perLine = Math.max(8, Math.floor(width / (fontSize * CHAR_WIDTH_RATIO)));
  return Math.max(1, Math.ceil(text.length / perLine));
}
