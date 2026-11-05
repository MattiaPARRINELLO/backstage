import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createSession } from "@/lib/session";

// Connexion locale simplifiee pour le developpement.
//
// Active uniquement par `DEV_AUTH_BYPASS=true` ET hors production : elle ouvre
// une session `owner` sans passer par WebAuthn, pour qu'un contributeur puisse
// voir l'app sans enregistrer de passkey. En production, la route repond 404
// meme si la variable est presente par erreur.
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production" || process.env.DEV_AUTH_BYPASS !== "true") {
    return NextResponse.json({ error: "Introuvable" }, { status: 404 });
  }

  await createSession("owner");
  return NextResponse.redirect(new URL("/chat", request.url));
}
