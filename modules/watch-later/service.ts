import { newId } from "@backstage/module-kit/storage-core";

import type { WatchLaterCategory, WatchLaterData, WatchLaterItem } from "./schema";
import { watchLaterStore } from "./store";

/**
 * Operations metier du module sur sa liste de liens.
 *
 * Elles remplacent les fonctions historiques de `lib/storage/watch-later.ts` :
 * meme fichier, meme comportement, mais le module ne depend plus de l'interieur
 * du noyau.
 */
export async function getWatchLater(): Promise<WatchLaterData> {
  return watchLaterStore.read();
}

export async function addWatchLaterItem(input: {
  url: string;
  title: string;
  description?: string | undefined;
  thumbnail?: string | undefined;
  source?: string | undefined;
  category?: WatchLaterCategory | undefined;
}): Promise<WatchLaterItem> {
  const item: WatchLaterItem = {
    id: newId(),
    url: input.url,
    title: input.title,
    description: input.description,
    thumbnail: input.thumbnail,
    read: false,
    source: input.source || detectSource(input.url),
    category: input.category || detectCategory(input.url),
    createdAt: new Date().toISOString(),
  };
  await watchLaterStore.mutate((data) => {
    data.items.unshift(item);
  });
  return item;
}

export async function updateWatchLaterItem(
  id: string,
  updates: {
    [K in "title" | "description" | "category" | "summary" | "aiTags" | "read"]?:
      | WatchLaterItem[K]
      | undefined;
  }
): Promise<WatchLaterItem | null> {
  let updated: WatchLaterItem | null = null;
  await watchLaterStore.mutate((data) => {
    const index = data.items.findIndex((item) => item.id === id);
    if (index < 0) return null;
    const current = data.items[index];
    if (!current) return null;
    const next = { ...current, ...updates };
    data.items[index] = next;
    updated = next;
  });
  return updated;
}

export async function deleteWatchLaterItem(id: string): Promise<boolean> {
  let deleted = false;
  await watchLaterStore.mutate((data) => {
    const before = data.items.length;
    data.items = data.items.filter((item) => item.id !== id);
    deleted = data.items.length !== before;
    return deleted ? undefined : null;
  });
  return deleted;
}

export async function reorderWatchLaterItems(orderedIds: string[]): Promise<boolean> {
  await watchLaterStore.mutate((data) => {
    const byId = new Map(data.items.map((item) => [item.id, item] as const));
    const next: typeof data.items = [];
    for (const id of orderedIds) {
      const found = byId.get(id);
      if (found) next.push(found);
    }
    for (const item of data.items) {
      if (!orderedIds.includes(item.id)) next.push(item);
    }
    data.items = next;
  });
  return true;
}

function detectSource(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host || "lien";
  } catch {
    return "lien";
  }
}

function detectCategory(url: string): WatchLaterCategory {
  const lower = url.toLowerCase();
  if (/(youtube\.com|youtu\.be|vimeo\.com|twitch\.tv)/.test(lower)) return "video";
  if (/spotify\.|soundcloud\.|bandcamp\./.test(lower)) return "music";
  if (/\.(jpg|jpeg|png|gif|webp|avif|unsplash|pexels|imgur)/.test(lower)) return "photo";
  if (/(medium\.|dev\.to|github\.com\/.*\/blob|arxiv\.|wikipedia|blog)/.test(lower)) return "article";
  return "other";
}
