"use server";

import { requireSession } from "@/lib/session";
import { createPasskeyPairCode } from "@/lib/passkey-pairing";

/**
 * Genere un code d'appairage pour enregistrer une cle d'acces sur un autre
 * appareil (typiquement un PC quand la seule passkey vit sur le telephone).
 *
 * La session est la seule barriere : l'appareil qui recoit la cle n'en a pas
 * encore. Le code est a usage unique, expire en 10 minutes, et ne permet que
 * d'enregistrer une passkey — jamais d'ouvrir une session sans biometrie.
 */
export async function createPasskeyPairing(): Promise<{ code: string; expiresAt: string }> {
  await requireSession();

  return createPasskeyPairCode();
}
