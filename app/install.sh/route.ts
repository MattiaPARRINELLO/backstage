import { readFileSync } from "fs";
import path from "path";

// Sert le script d'installation en une commande :
//   curl -fsSL https://brain.mprnl.fr/install.sh | bash
// Fichier source unique : scripts/install.sh (versionné, relu, testé).
// Le chemin est public (PUBLIC_PATHS dans proxy.ts).
//
// Le fichier est embarqué dans le bundle standalone via outputFileTracingIncludes
// (next.config.ts) : pas de lecture disque au runtime hors build, et donc pas de
// risque de servir autre chose que la version commitée.

// Cache process : le contenu ne change qu'à chaque déploiement.
let cached: string | null = null;

const SCRIPT_PATH = path.join(process.cwd(), "scripts", "install.sh");

export async function GET() {
  let body = cached;
  if (body === null) {
    try {
      body = readFileSync(SCRIPT_PATH, "utf-8");
      cached = body;
    } catch {
      return new Response("#!/usr/bin/env bash\necho 'install.sh introuvable sur cette instance' >&2\nexit 1\n", {
        status: 404,
        headers: { "Content-Type": "text/x-shellscript; charset=utf-8" },
      });
    }
  }

  return new Response(body, {
    headers: {
      "Content-Type": "text/x-shellscript; charset=utf-8",
      "Content-Disposition": 'inline; filename="install.sh"',
      // Le script est versionné : on permet la mise en cache courte.
      "Cache-Control": "public, max-age=300",
    },
  });
}
