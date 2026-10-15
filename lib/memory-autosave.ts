// Memorisation automatique des faits durables extraits d'une conversation.
//
// Ce module est volontairement SANS verification de session : il est appele
// soit depuis une Server Action deja authentifiee (app/actions/brain.ts), soit
// depuis la route de chat dont le handler verifie la session en premiere
// ligne. C'est ce qui lui permet de tourner hors du contexte requete Next
// (promesse detachee, after(), scheduler) sans casser l'ecriture — l'ancien
// chemin appelait requireSession() et jetait donc en silence.
import {
  addMemoryFact,
  findSimilarMemoryFacts,
  getMemory,
  logActivity,
  touchMemoryFact,
} from "./storage";
import type { MemoryCategory, MemoryFact } from "./types";

export interface ExtractedFact {
  content: string;
  category: MemoryCategory;
  confidence: number;
}

// En dessous de ce seuil, un fait extrait n'est pas memorise : une information
// incertaine ne merite pas une entree permanente en memoire.
export const MIN_FACT_CONFIDENCE = 0.7;

// Plafond par tour de chat : l'extraction ne doit jamais saturer la memoire.
export const MAX_FACTS_PER_TURN = 8;

// Longueur maximale d'un fait memorise (alignee sur l'ancien controle).
const MAX_FACT_LENGTH = 280;

function normalizeConfidence(raw: string): number | null {
  const value = Number.parseFloat(raw.replace(",", "."));
  if (Number.isNaN(value)) return null;
  // "85" ou "85%" (entier nu) vaut 0.85. En revanche "2.5" est hors bornes et
  // ne doit surtout pas etre divise par 100 : ce n'est pas un pourcentage.
  if (Number.isInteger(value) && value > 1) return value / 100;
  if (value < 0 || value > 1) return null;
  return value;
}

/**
 * Lit la sortie du modele extracteur.
 *
 * Le format demande est `- [categorie] [confiance] enonce`, mais on tolere les
 * derives courants : puce markdown, numerotation, gras, categorie sans
 * crochets, virgule decimale francaise, pourcentage. Une ligne sans
 * CONFIANCE explicite est ignoree : c'est ce qui distingue un fait d'une
 * phrase de commentaire ("Dev : rien a signaler") et evite les faux positifs.
 */
export function parseExtractedFacts(raw: string): ExtractedFact[] {
  if (!raw) return [];
  if (raw.trim().toUpperCase().startsWith("NONE")) return [];

  const facts: ExtractedFact[] = [];
  for (const rawLine of raw.split("\n")) {
    // Puce / numerotation / marqueurs markdown en tete de ligne : on l'ignore.
    const line = rawLine.trim().replace(/^[^A-Za-z\[]+/, "");
    if (!line) continue;

    const categoryMatch = line.match(/^\[?(dev|photo|life|preference)\]?[\]\)]?\s*[:–-]?/i);
    if (!categoryMatch) continue;
    const category = categoryMatch[1].toLowerCase() as MemoryCategory;
    const rest = line.slice(categoryMatch[0].length);

    const confidenceMatch = rest.match(/^\s*\[?\s*(\d{1,2}(?:[.,]\d+)?)\s*%?\s*\]?\s*[:–-]?/);
    if (!confidenceMatch) continue;
    const confidence = normalizeConfidence(confidenceMatch[1]);
    if (confidence === null) continue;

    const content = rest.slice(confidenceMatch[0].length).trim().replace(/^[:–-]\s*/, "").trim();
    if (content.length < 3 || content.length > MAX_FACT_LENGTH) continue;

    facts.push({ content, category, confidence });
  }
  return facts.slice(0, MAX_FACTS_PER_TURN);
}

/**
 * Faits deja en memoire, formatés pour le prompt d'extraction : le modele sait
 * ce qui est connu et ne le re-propose pas a chaque tour.
 */
export async function listFactsForExtractionPrompt(limit = 60): Promise<string> {
  try {
    const memory = await getMemory();
    if (!memory.facts || memory.facts.length === 0) return "";
    return memory.facts
      .slice(-limit)
      .map((f) => `- [${f.category}] ${f.content}`)
      .join("\n");
  } catch {
    // Memoire illisible : l'extraction tourne sans historique connu.
    return "";
  }
}

/**
 * Enregistre les faits extraits, avec dedoublonnage par similarite semantique.
 * Un fait deja connu n'est pas recree : il est remonte (accessCount +
 * lastAccessedAt), ce qui le fait remonter dans le prompt systeme.
 */
export async function persistExtractedFacts(facts: ExtractedFact[]): Promise<MemoryFact[]> {
  const saved: MemoryFact[] = [];
  for (const fact of facts.slice(0, MAX_FACTS_PER_TURN)) {
    if (fact.confidence < MIN_FACT_CONFIDENCE) continue;

    const existing = await findSimilarMemoryFacts(fact.content, fact.category);
    if (existing) {
      await touchMemoryFact(existing.id);
      saved.push(existing);
      continue;
    }

    const created = await addMemoryFact(fact.content, fact.category, {
      source: "auto-extract",
      confidence: fact.confidence,
    });
    await logActivity("memory_added", `Mémorisé : ${fact.content.slice(0, 80)}`, fact.category);
    saved.push(created);
  }
  return saved;
}
