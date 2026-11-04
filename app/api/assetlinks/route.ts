import { NextResponse } from "next/server";

/**
 * Digital Asset Links : prouve à Chrome que l'APK `BACKSTAGE` et le domaine
 * brain.mprnl.fr appartiennent au même éditeur. Sans ce fichier, le TWA
 * s'ouvre avec une barre d'URL au lieu du plein écran.
 *
 * Servi sur `/.well-known/assetlinks.json` via une réécriture Next.
 *
 * L'empreinte est publique par nature (elle est aussi dans l'APK) ; elle peut
 * être surchargée par `ANDROID_CERT_SHA256` si la clé de signature change.
 */
const ANDROID_PACKAGE = "com.personalbrain.backstage";

// Empreinte SHA-256 de la clé de signature release (android/keystore).
const DEFAULT_SHA256 =
  "E2:F9:AC:96:EC:B2:97:0E:BF:9C:5D:A8:7B:77:C4:28:BC:AC:1D:88:91:03:E3:DF:C4:98:3F:0F:DE:00:86:3E";

export async function GET() {
  const fingerprint = (process.env.ANDROID_CERT_SHA256 || DEFAULT_SHA256)
    .trim()
    .toUpperCase();

  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: ANDROID_PACKAGE,
        sha256_cert_fingerprints: [fingerprint],
      },
    },
  ];

  return NextResponse.json(body, {
    headers: {
      "Cache-Control": "public, max-age=3600",
    },
  });
}
