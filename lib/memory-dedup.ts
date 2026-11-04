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
 * Deux autres pertes observees, corrigees ici :
 * - un fait court et courant (« pas de carte de presse ») ne porte aucune entite
 *   distinctive ; sans controle de sujet il etait absorbe par le fait que le
 *   modele avait designe comme « le plus proche » alors qu'il parlait d'autre
 *   chose ;
 * - une negation (« pas de carte de presse ») face a une affirmation
 *   (« a une carte de presse ») est une contradiction, pas une reformulation.
 *
 * Regle : un fait n'est un doublon que s'il porte le meme sujet et la meme
 * polarite, et qu'il n'apporte aucune entite absente. Module PUR (aucun import) :
 * testable sans FS ni IA.
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

function tokenize(text: string): string[] {
  return (text ?? "")
    .split(/[\s,;:!?()[\]{}"'«»|]+/)
    .map(cleanToken)
    .filter(Boolean);
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

/** Marqueurs de negation : ils inversent le sens de l'enonce. */
const NEGATION_MARKERS = new Set([
  "pas",
  "jamais",
  "aucun",
  "aucune",
  "sans",
  "ni",
  "nullement",
]);

/** Mots grammaticaux : ils ne disent rien du sujet d'un fait. */
const STOPWORDS = new Set([
  "le",
  "la",
  "les",
  "un",
  "une",
  "des",
  "de",
  "du",
  "au",
  "aux",
  "et",
  "ou",
  "mais",
  "donc",
  "or",
  "car",
  "que",
  "qui",
  "quoi",
  "dont",
  "en",
  "dans",
  "sur",
  "sous",
  "pour",
  "par",
  "avec",
  "chez",
  "est",
  "sont",
  "etre",
  "ete",
  "avoir",
  "ai",
  "as",
  "avons",
  "avez",
  "ont",
  "il",
  "elle",
  "on",
  "nous",
  "vous",
  "ils",
  "elles",
  "je",
  "tu",
  "se",
  "sa",
  "son",
  "ses",
  "ce",
  "cet",
  "cette",
  "ces",
  "mon",
  "ma",
  "mes",
  "ton",
  "ta",
  "tes",
  "notre",
  "nos",
  "votre",
  "vos",
  "leur",
  "leurs",
  "plus",
  "moins",
  "tres",
  "bien",
  "aussi",
  "comme",
  "ne",
  "que",
]);

/**
 * Part de sujet partagee en dessous de laquelle deux enonces parlent de choses
 * differentes. Un fait de meme sujet reformule partage l'essentiel de ses mots
 * porteurs ; un fait hors sujet n'en partage aucun.
 */
const MIN_TOPIC_OVERLAP = 0.4;

/** Mots porteurs d'un enonce (hors mots grammaticaux, hors tres courts). */
function contentTokens(text: string): string[] {
  return tokenize(normalizeFactText(text)).filter(
    (token) => token.length >= 3 && !STOPWORDS.has(token) && !NEGATION_MARKERS.has(token)
  );
}

/** L'enonce porte-t-il une negation ? */
function isNegated(text: string): boolean {
  return tokenize(normalizeFactText(text)).some((token) => NEGATION_MARKERS.has(token));
}

/**
 * Les deux enonces partagent-ils assez de mots porteurs pour parler du meme
 * sujet ? Le rapport est normalise par le plus court des deux, pour qu'un fait
 * court ne soit pas declare hors sujet face a un fait long qui le contient.
 */
function sharesTopic(candidate: string, existing: string): boolean {
  const candidateTokens = contentTokens(candidate);
  const existingTokens = contentTokens(existing);
  if (candidateTokens.length === 0 || existingTokens.length === 0) return true;

  const existingSet = new Set(existingTokens);
  const shared = candidateTokens.filter((token) => existingSet.has(token)).length;

  return shared / Math.min(candidateTokens.length, existingTokens.length) >= MIN_TOPIC_OVERLAP;
}

/**
 * Le fait candidat apporte-t-il quelque chose que le fait existant ne contient
 * pas ? Si oui, ce n'est pas un doublon : il doit etre enregistre.
 */
export function hasNewInformation(candidate: string, existing: string): boolean {
  const candidateNorm = normalizeFactText(candidate);
  const existingNorm = normalizeFactText(existing);
  if (!existingNorm) return true;
  if (candidateNorm === existingNorm) return false;

  // Negation contre affirmation : c'est une contradiction, la perdre revient a
  // affirmer le contraire de ce que l'utilisateur a dit.
  if (isNegated(candidate) !== isNegated(existing)) return true;

  const tokens = tokenize(candidate);

  const bringsNewEntity = tokens.some((token, index) => {
    if (!isDistinctive(token, index === 0)) return false;
    // Entite deja citee telle quelle dans le fait existant ?
    return !existingNorm.includes(normalizeFactText(token));
  });
  if (bringsNewEntity) return true;

  // Aucun mot porteur commun : le fait parle d'autre chose, meme si le modele
  // de similarite a cru reconnaitre une proximite de theme.
  if (!sharesTopic(candidate, existing)) return true;

  return false;
}
