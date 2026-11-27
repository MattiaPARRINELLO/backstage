import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import type { Dirent } from "fs";
import path from "path";
import { clearSession } from "@/lib/session";
import { authedRoute } from "@/lib/route";
import { getDataDir } from "@/lib/storage-core";

const DATA_DIR = getDataDir();

// Conservés après suppression : fichiers d'infrastructure non personnels.
// La clé de signature (.auth-secret) permet de se réinscrire sans rotation.
const KEEP = new Set([".gitkeep", ".auth-secret"]);

export const POST = authedRoute(async (_session) => {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(DATA_DIR, { withFileTypes: true });
  } catch {
    entries = [];
  }

  let removed = 0;
  for (const entry of entries) {
    if (KEEP.has(entry.name)) continue;
    const full = path.join(DATA_DIR, entry.name);
    try {
      if (entry.isDirectory()) {
        await fs.rm(full, { recursive: true, force: true });
      } else {
        await fs.unlink(full);
      }
      removed++;
    } catch (err) {
      console.error(`[account/delete] Impossible de supprimer ${entry.name}:`, err);
    }
  }

  // Invalide le cache mémoire serveur pour ne pas resservir d'anciennes données.
  try {
    const { invalidateServerCache } = await import("@/lib/server-cache");
    invalidateServerCache("calendar:list");
  } catch {
    // Cache non initialisé : rien à faire.
  }

  await clearSession();

  return NextResponse.json({ ok: true, removed });
});
