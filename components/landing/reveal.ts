import type { CSSProperties } from "react";

/**
 * Attributs d'entrée pour un bloc de la landing.
 * Le décalage permet d'échelonner titre → texte → image → action
 * (60–90 ms entre deux éléments d'un même bloc).
 */
export function reveal(delay = 0) {
  return {
    "data-reveal": "",
    style: { "--d": `${delay}ms` } as CSSProperties,
  };
}
