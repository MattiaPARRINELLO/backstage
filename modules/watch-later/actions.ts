import { defineAction } from "@backstage/module-kit";
import { z } from "zod";

import {
  addWatchLaterItem,
  deleteWatchLaterItem,
  getWatchLater,
  reorderWatchLaterItems,
  updateWatchLaterItem,
} from "./service";
import { summarizePage } from "./summary";

const categorySchema = z.enum(["video", "article", "photo", "music", "other"]);

const createInput = z.object({
  url: z.string().trim().url("URL invalide"),
  title: z.string().trim().min(1, "Titre requis"),
  description: z.string().trim().optional(),
  thumbnail: z.string().trim().url().optional().or(z.literal("")),
  source: z.string().trim().optional(),
  category: categorySchema.optional(),
});

const updateInput = z
  .object({
    id: z.string().min(1, "Identifiant requis"),
    title: z.string().trim().min(1).optional(),
    description: z.string().trim().optional(),
    category: categorySchema.optional(),
  })
  .strict();

const idInput = z.object({
  id: z.string().min(1, "Identifiant requis"),
});

const reorderInput = z.object({
  orderedIds: z.array(z.string()).min(1, "Liste d'IDs invalide"),
});

/**
 * Actions du module A voir plus tard.
 *
 * La logique metier et le stockage vivent dans le module ; le noyau porte la
 * session, la validation et la revalidation. Le journal d'activite passe par
 * `ctx.activity`, jamais par un import de `lib/storage`.
 */
export const loadWatchLaterAction = defineAction({
  name: "load",
  input: z.object({}),
  run: async () => getWatchLater(),
});

export const createWatchLaterAction = defineAction({
  name: "create",
  input: createInput,
  revalidate: ["/m/watch-later"],
  run: async (input, ctx) => {
    const item = await addWatchLaterItem({
      ...input,
      thumbnail: input.thumbnail ? input.thumbnail : undefined,
    });
    await ctx.activity?.("watch_later_added", `À voir : ${item.title}`, item.url);

    // Resume IA : jamais plus de 15 s, et l'echec ne bloque pas la creation.
    try {
      const summarize = (async () => {
        const { summary, tags } = await summarizePage(ctx, item.url, item.title);
        if (summary || tags.length > 0) {
          await updateWatchLaterItem(item.id, { summary, aiTags: [...tags] });
        }
      })();
      const timeout = new Promise<"timeout">((resolve) =>
        setTimeout(() => resolve("timeout"), 15_000)
      );
      await Promise.race([summarize, timeout]);
    } catch (err) {
      ctx.log("error", "resume automatique echoue", err);
    }

    return item;
  },
});

export const summarizeWatchLaterAction = defineAction({
  name: "summarize",
  input: idInput,
  revalidate: ["/m/watch-later"],
  run: async ({ id }, ctx) => {
    const data = await getWatchLater();
    const item = data.items.find((entry) => entry.id === id);
    if (!item) return null;

    const result = await summarizePage(ctx, item.url, item.title);
    if (result.summary || result.tags.length > 0) {
      await updateWatchLaterItem(id, {
        summary: result.summary,
        aiTags: [...result.tags],
      });
    }
    return { summary: result.summary, tags: [...result.tags] };
  },
});

export const editWatchLaterAction = defineAction({
  name: "edit",
  input: updateInput,
  revalidate: ["/m/watch-later"],
  run: async ({ id, ...updates }) => updateWatchLaterItem(id, updates),
});

export const removeWatchLaterAction = defineAction({
  name: "remove",
  input: idInput,
  revalidate: ["/m/watch-later"],
  run: async ({ id }, ctx) => {
    const ok = await deleteWatchLaterItem(id);
    if (ok) {
      await ctx.activity?.(
        "watch_later_deleted",
        "Element retire de A voir plus tard",
        id
      );
    }
    return ok;
  },
});

export const reorderWatchLaterAction = defineAction({
  name: "reorder",
  input: reorderInput,
  revalidate: ["/m/watch-later"],
  run: async ({ orderedIds }) => reorderWatchLaterItems(orderedIds),
});
