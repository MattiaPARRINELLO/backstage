import { z } from "zod";
import { defineTool, toolError, toolOk, verifyWrite } from "@backstage/module-kit";

import { addWatchLaterItem, getWatchLater, isSafeFetchUrl } from "@/lib/storage";

const categorySchema = z.enum(["video", "article", "photo", "music", "other"]);

/**
 * Ajout d'un lien à « À voir plus tard ».
 *
 * Logique reprise du dispatch du noyau. Le stockage reste dans le noyau
 * (`lib/storage/watch-later.ts`) : le module ne fait que valider et écrire,
 * puis relit pour ne jamais annoncer un enregistrement qui n'a pas eu lieu.
 */
export const addWatchLaterTool = defineTool({
  name: "add",
  description:
    "Garde un lien (article, video, photo, musique) dans la liste « A voir plus tard ». Utilise-le quand l'utilisateur veut conserver un contenu pour plus tard. Fournis une URL complete et un titre lisible ; description, miniature et categorie sont optionnelles.",
  params: z.object({
    url: z.string().min(1, "URL requise"),
    title: z.string().min(1, "Titre requis"),
    description: z.string().optional(),
    thumbnail: z.string().optional(),
    category: categorySchema.optional(),
  }),
  sideEffect: "write",
  run: async (args) => {
    // Anti-SSRF : jamais d'adresse privee ou invalide.
    if (!(await isSafeFetchUrl(args.url))) {
      return toolError("Erreur : URL non autorisee (adresse privee ou invalide).");
    }

    const item = await addWatchLaterItem({
      url: args.url,
      title: args.title,
      description: args.description,
      thumbnail: args.thumbnail,
      category: args.category,
    });

    const problem = await verifyWrite(`le lien "${item.title}"`, async () => {
      const after = await getWatchLater();
      return after.items.some((entry) => entry.id === item.id);
    });
    if (problem) return toolError(problem);

    return toolOk(`Ajoute a 'A voir plus tard' : ${item.title} (${item.source}).`);
  },
});
