/**
 * Garde anti-perte d'information du dedoublonnage memoire.
 *
 * Pourquoi : le dedoublonnage compare un fait candidat a un fait existant de la
 * meme categorie. Sans garde, un fait *enrichi* (« Est photographe live &
 * concert, collabore avec Rapstar, portfolio photo.mprnl.fr ») peut etre juge
 * « deja connu » parce qu'il reprend le noyau d'un fait existant, et les
 * informations nouvelles — nom propre, chiffre, URL, pseudo — sont perdues en
 * silence alors que l'utilisateur a explicitement demande de les retenir.
 *
 * Regle : un fait qui apporte une entite absente du fait existant n'est jamais
 * un doublon. Module PUR (aucun import) : testable sans FS ni IA.
 */

/** Minuscules, sans accents, espaces normalises. */
export function normalizeFactText(text: string): string {
  return (text ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function cleanToken(raw: string): string {
  return raw.replace(/^[^\p{L}\p{N}@]+|[^\p{L}\p{N}]+$/gu, "");
}

/**
 * Un token est distinctif s'il porte une information qu'une reformulation ne
 * fabrique pas : un chiffre (21k, 35mm, 2026), une URL ou un pseudo
 * (photo.mprnl.fr, @rapstar_france), ou un nom propre (Rapstar).
 *
 * Le premier mot de la phrase est ignore pour la detection de majuscule : sa
 * capitale est grammaticale, pas significative.
 */
function isDistinctive(token: string, isFirstToken: boolean): boolean {
  if (token.length < 2) return false;
  if (/\d/.test(token)) return true;
  if (/[@/]/.test(token)) return true;
  if (/\p{L}\.\p{L}/u.test(token)) return true; // domaine / fichier
  if (!isFirstToken && /^\p{Lu}/u.test(token) && token.length >= 3) return true;
  return false;
}

/**
 * Le fait candidat apporte-t-il quelque chose que le fait existant ne contient
 * pas ? Si oui, ce n'est pas un doublon : il doit etre enregistre.
 */
export function hasNewInformation(candidate: string, existing: string): boolean {
  const existingNorm = normalizeFactText(existing);
  if (!existingNorm) return true;

  const tokens = (candidate ?? "")
    .split(/[\s,;:!?()[\]{}"'«»|]+/)
    .map(cleanToken)
    .filter(Boolean);

  return tokens.some((token, index) => {
    if (!isDistinctive(token, index === 0)) return false;
    // Entite deja citee telle quelle dans le fait existant ?
    return !existingNorm.includes(normalizeFactText(token));
  });
}
