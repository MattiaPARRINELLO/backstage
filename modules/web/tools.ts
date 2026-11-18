import { z } from "zod";
import { defineTool, toolEmpty, toolError, toolOk } from "@backstage/module-kit";

import { fetchPageMeta, webSearch } from "@/lib/storage";

/**
 * Recherche web et metadonnees de page.
 *
 * Les deux resultats sont du contenu tiers : `trust: "untrusted"`. La garde
 * anti-SSRF (`isSafeFetchUrl`, redirections re-verifiees) reste dans
 * `lib/web.ts` ; le module se contente de classer le resultat.
 */

export const webSearchTool = defineTool({
  name: "search",
  description:
    "Effectue une recherche web pour recuperer des informations d'actualite ou des faits generaux.",
  params: z.object({
    query: z.string().trim().min(1, "Requete de recherche requise"),
  }),
  sideEffect: "read",
  trust: "untrusted",
  run: async (args) => {
    const text = (await webSearch(args.query)).trim();
    const lower = text.toLowerCase();
    if (!text || lower.startsWith("aucun") || lower.includes(": aucun")) {
      return toolEmpty(text || `Recherche web pour "${args.query}" : aucun resultat trouve.`);
    }
    return toolOk(text);
  },
});

export const pageMetaTool = defineTool({
  name: "page_meta",
  description: "Recupere le titre et la miniature d'une page web ou video YouTube.",
  params: z.object({
    url: z.string().trim().min(1, "URL requise"),
  }),
  sideEffect: "read",
  trust: "untrusted",
  run: async (args) => {
    const meta = await fetchPageMeta(args.url);
    const title = meta.title.trim();

    // `fetchPageMeta` encode ses echecs dans le titre.
    if (!title || title.startsWith("URL non autorisée") || title.startsWith("Impossible de récupérer")) {
      return toolError(title || "Impossible de recuperer la page.");
    }
    if (title === "Titre non trouvé") {
      return toolEmpty("Aucun titre exploitable sur cette page.");
    }

    const thumbnail = meta.thumbnail ? `\nMiniature : ${meta.thumbnail}` : "";
    return toolOk(`Titre : ${title}${thumbnail}`);
  },
});
