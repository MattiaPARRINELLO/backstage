import { chatCompletion, type StreamEvent } from "@/lib/ai-providers";
import {
  listFactsForExtractionPrompt,
  parseExtractedFacts,
  persistExtractedFacts,
  type ExtractedFact,
} from "@/lib/memory-autosave";
import type { ChatRequestMessage } from "@/lib/types";
import { serverLog } from "@/lib/logger";

/**
 * Extraction des faits durables d'un tour de chat, puis ecriture en memoire.
 *
 * Une seule responsabilite : decider s'il y a matiere a extraire, demander les
 * faits au modele et les persister. Le module ne connait ni le SSE, ni le flux
 * HTTP, ni le registre des runs : l'appelant fournit le modele, l'historique,
 * la session, le contenu assistant du tour et de quoi diffuser l'evenement.
 */

type TranscriptMessage = { role: "user" | "assistant"; content: string };

export async function extractMemoryFacts(
  model: string,
  transcript: { role: "user" | "assistant"; content: string }[],
  sessionId: string
): Promise<ExtractedFact[]> {
  const sysPrompt = `Tu es un extracteur de memoire pour un second cerveau personnel.
Analyse l'echange ci-dessous et extrais UNIQUEMENT les faits durables, stables et utiles a long terme sur l'utilisateur.
Categories autorisees: dev (preferences/competences techniques), photo (materiel, style, workflow), life (habitudes, contraintes, contexte personnel), preference (preferences generales).
Exclure: demandes ponctuelles, salutations, questions ephemeres, opinions changeantes.
Exclure aussi tout fait deja present dans la liste "Deja en memoire" ci-dessous : ne le repete pas.
Format de sortie STRICT: une ligne par fait au format "- [categorie] [confiance entre 0 et 1] enonce court".
Si rien de nouveau n'est memorisable, retourne EXACTEMENT: NONE
Pas de markdown, pas de numerotation, pas de preambule.`;

  // Faits deja connus : injectes pour eviter que le modele re-extrait en boucle
  // la meme information a chaque tour.
  const knownFacts = await listFactsForExtractionPrompt();

  const userPrompt = `Echange recent (les 6 derniers messages) :
${transcript
    .slice(-6)
    .map((m) => `${m.role === "user" ? "USER" : "ASSISTANT"}: ${m.content}`)
    .join("\n")}
${knownFacts ? `\nDeja en memoire (ne pas repeter) :\n${knownFacts}\n` : ""}
Faits a extraire :`;

  try {
    const result = await chatCompletion(
      model,
      [
        { role: "system", content: sysPrompt },
        { role: "user", content: userPrompt },
      ],
      [],
      undefined,
      sessionId
    );

    // Parsing tolerant (puces, gras, virgule decimale, pourcentage) : un
    // ecart de format du modele ne doit plus faire perdre les faits.
    return parseExtractedFacts(result.content);
  } catch (err) {
    void serverLog("chat", "error", "Memory extraction failed", err, true);
    return [];
  }
}

function isTranscriptMessage(message: ChatRequestMessage): message is TranscriptMessage {
  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string" &&
    message.content.length > 0
  );
}

export async function runMemoryExtraction(
  model: string,
  originalMessages: ChatRequestMessage[],
  sessionId: string,
  send?: (data: StreamEvent) => void,
  newAssistantContent?: string
): Promise<void> {
  try {
    const transcript: TranscriptMessage[] = originalMessages
      .filter(isTranscriptMessage)
      .map((m) => ({ role: m.role, content: m.content }));
    if (newAssistantContent && newAssistantContent.length > 0) {
      transcript.push({ role: "assistant", content: newAssistantContent });
    }
    if (transcript.length < 2) return;
    const lastUser = [...transcript].reverse().find((m) => m.role === "user");
    if (!lastUser || lastUser.content.length < 12) return;
    const lastAssistant = [...transcript].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant || lastAssistant.content.length < 24) return;

    const facts = await extractMemoryFacts(model, transcript, sessionId);
    if (facts.length === 0) return;
    // Ecriture directe, sans requireSession() : la session est deja validee en
    // tete de handler, et cette fonction tourne dans une promesse que le
    // contexte requete Next ne garantit plus (l'appel est await avant la
    // fermeture du flux, mais un detachement resterait possible).
    await persistExtractedFacts(facts);
    send?.({ type: "memory_facts", facts });
  } catch (err) {
    void serverLog("chat", "error", "Memory extraction error", err, true);
  }
}
