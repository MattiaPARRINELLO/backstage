import { z } from "zod";

/**
 * Schéma de donnees du module.
 *
 * Le module est proprietaire de son format : le noyau ne connait ni les champs
 * d'un lien ni ses categories. Le fichier reste `data/watch-later.json`, le
 * chemin historique, declare comme `legacyPath` au store.
 */
export const watchLaterCategorySchema = z.enum([
  "video",
  "article",
  "photo",
  "music",
  "other",
]);

export const watchLaterItemSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  thumbnail: z.string().optional(),
  source: z.string().min(1),
  category: watchLaterCategorySchema,
  createdAt: z.string().min(1),
  summary: z.string().optional(),
  aiTags: z.array(z.string()).optional(),
  read: z.boolean().optional(),
});

export const watchLaterDataSchema = z.object({
  items: z.array(watchLaterItemSchema),
});

export type WatchLaterCategory = z.infer<typeof watchLaterCategorySchema>;
export type WatchLaterItem = z.infer<typeof watchLaterItemSchema>;
export type WatchLaterData = z.infer<typeof watchLaterDataSchema>;

/** Valeur par defaut, clonee par le store a chaque lecture. */
export const emptyWatchLater: WatchLaterData = { items: [] };
