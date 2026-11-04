import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticateDevice, redeemPairCode } from "@/lib/fcm-devices";

/**
 * Appairage d'un appareil Android pour les notifications natives.
 *
 * Route **publique** (l'APK n'a pas de cookie de session) mais protégée par un
 * code à usage unique, généré depuis l'app web authentifiée et valable
 * 10 minutes. Un appareil déjà appairé renvoie son secret pour rafraîchir son
 * jeton FCM quand Firebase le renouvelle.
 */

const bodySchema = z
  .object({
    token: z.string().trim().min(20, "Jeton FCM invalide").max(4096),
    code: z.string().trim().min(4).max(64).optional(),
    secret: z.string().trim().min(20).max(256).optional(),
  })
  .strict();

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Payload invalide" },
      { status: 400 }
    );
  }

  const { token, code, secret } = parsed.data;

  try {
    if (secret) {
      const known = await authenticateDevice(token, secret);
      if (!known) {
        return NextResponse.json({ error: "Secret inconnu" }, { status: 401 });
      }
      return NextResponse.json({ ok: true, refreshed: true });
    }

    if (!code) {
      return NextResponse.json({ error: "Code d'appairage requis" }, { status: 400 });
    }

    const result = await redeemPairCode(code, token);
    if (!result) {
      return NextResponse.json({ error: "Code invalide ou expire" }, { status: 401 });
    }

    console.log("[fcm] appareil appaire");
    return NextResponse.json({ ok: true, secret: result.secret });
  } catch (err) {
    console.error("[fcm pair]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}
