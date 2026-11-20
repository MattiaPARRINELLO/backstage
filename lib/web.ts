// Utilitaires web partagés : recherche, récupération de métadonnées de page,
// extraction de texte et garde-fou anti-SSRF (bloque les URLs privées/réservées).
import { getConfig } from "@/lib/config";
import { request as httpRequest } from "@/lib/http";

export async function webSearch(query: string): Promise<string> {
  const braveKey = getConfig().BRAVE_SEARCH_API_KEY;
  if (braveKey) {
    try {
      const res = await httpRequest(
        `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}`,
        {
          label: "brave",
          timeoutMs: 10_000,
          retries: 0,
          headers: {
            "Accept": "application/json",
            "Accept-Encoding": "gzip",
            "X-Subscription-Token": braveKey,
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const results = data.web?.results ?? [];
        if (results.length > 0) {
          return results.slice(0, 3).map((r: { title: string; url: string; description: string }) =>
            `- ${r.title}\n  ${r.description}\n  ${r.url}`
          ).join("\n\n");
        }
        return `Aucun résultat web pour "${query}".`;
      }
    } catch {
      // Fallback à DuckDuckGo
    }
  }

  // Fallback : recherche DuckDuckGo (gratuite, sans clé)
  try {
    const res = await httpRequest(
      `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1`,
      { label: "duckduckgo", timeoutMs: 10_000, retries: 0 }
    );
    if (res.ok) {
      const data = await res.json();
      const abstract = data.AbstractText;
      const results = data.RelatedTopics ?? [];
      if (abstract) {
        return abstract;
      }
      if (results.length > 0) {
        const texts = results.slice(0, 3).map((r: { Text?: string; Result?: string }) =>
          r.Text ?? r.Result ?? ""
        ).filter(Boolean);
        if (texts.length > 0) return texts.join("\n\n");
      }
    }
  } catch {
    // Aucun résultat : message de repli plus bas
  }

  return `Recherche web pour "${query}" : aucun résultat trouvé.`;
}

function extractYouTubeId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

// Anti-SSRF : n'autorise que des URLs http(s) publiques. Bloque les adresses
// privées/réservées (localhost, RFC1918, link-local, metadata cloud) pour que
// le fetch automatique d'URLs utilisateur ne puisse pas atteindre le réseau
// interne ni les endpoints de métadonnées cloud.
// Si la résolution DNS échoue, on refuse : un fail-open laisserait passer une
// cible dont la résolution est contrôlée par l'attaquant (DNS rebinding).

const PRIVATE_IPV4_PATTERNS = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./, // CGNAT (100.64.0.0/10)
  /^224\./,
  /^240\./,
];

// Convertit un hostname en adresse IPv4 "dotted" si c'en est une, en gérant
// les formes exotiques (décimale 32-bit, octale, hexadécimale, IPv4-mapped)
// que les regex naïves laissent passer. Retourne null si ce n'est pas une IP.
function normalizeIpv4(hostname: string): string | null {
  const clean = hostname.replace(/^\[|\]$/g, "");

  // IPv4-mapped IPv6 en notation décimale : ::ffff:127.0.0.1 ou ::127.0.0.1
  const mapped = clean.match(/^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/i);
  if (mapped) return mapped[1];

  // Une seule partie entière : entier 32 bits (décimal, 0x hexa ou 0 octal)
  if (/^\d+$/.test(clean) || /^0x[0-9a-f]+$/i.test(clean)) {
    try {
      const value = Number(clean);
      if (!Number.isFinite(value) || value < 0 || value > 0xffffffff) return null;
      return `${(value >>> 24) & 0xff}.${(value >>> 16) & 0xff}.${(value >>> 8) & 0xff}.${value & 0xff}`;
    } catch {
      return null;
    }
  }

  // Quatre parties séparées par des points (éventuellement octal/hexa)
  const parts = clean.split(".");
  if (parts.length !== 4 || parts.some((p) => !/^\d+$/.test(p))) return null;
  const bytes: number[] = [];
  for (const p of parts) {
    // 0177 = octal ; 0x7f = hexa ; sinon décimal
    const base = p.startsWith("0x") ? 16 : p.startsWith("0") && p.length > 1 ? 8 : 10;
    const v = parseInt(p, base);
    if (Number.isNaN(v) || v < 0 || v > 255) return null;
    bytes.push(v);
  }
  return bytes.join(".");
}

// Développe une IPv6 en 8 groupes hexadécimaux (16 bits chacun). Gère la
// compression "::", une éventuelle zone d'interface et une queue IPv4
// (::ffff:127.0.0.1). Retourne null si ce n'est pas une IPv6 valide.
function expandIpv6(hostname: string): number[] | null {
  let clean = hostname.replace(/^\[|\]$/g, "").toLowerCase();
  clean = clean.split("%")[0];
  if (!clean.includes(":")) return null;

  // Queue en notation IPv4 (::ffff:127.0.0.1) : la convertir en deux groupes.
  const lastColon = clean.lastIndexOf(":");
  const tail = clean.slice(lastColon + 1);
  if (tail.includes(".")) {
    const v4 = normalizeIpv4(tail);
    if (v4 === null) return null;
    const [a, b, c, d] = v4.split(".").map(Number);
    clean = `${clean.slice(0, lastColon + 1)}${(((a << 8) | b) >>> 0).toString(16)}:${(
      ((c << 8) | d) >>> 0
    ).toString(16)}`;
  }

  const halves = clean.split("::");
  if (halves.length > 2) return null;
  const splitGroups = (part: string): string[] => (part === "" ? [] : part.split(":"));

  let groups: string[];
  if (halves.length === 1) {
    groups = splitGroups(halves[0]);
    if (groups.length !== 8) return null;
  } else {
    const head = splitGroups(halves[0]);
    const rest = splitGroups(halves[1]);
    const missing = 8 - head.length - rest.length;
    if (missing < 1) return null;
    groups = [...head, ...Array<string>(missing).fill("0"), ...rest];
  }

  const parsed: number[] = [];
  for (const group of groups) {
    if (!/^[0-9a-f]{1,4}$/.test(group)) return null;
    parsed.push(parseInt(group, 16));
  }
  return parsed;
}

function isPrivateIpv6(hostname: string): boolean {
  const groups = expandIpv6(hostname);
  if (groups === null) return false;

  // :: (non spécifié), ::1 (loopback) et la famille IPv4-mapped/compatible
  // (::ffff:0:0, ::ffff:127.0.0.1, ::127.0.0.1) : les cinq premiers groupes
  // sont nuls et le sixième vaut 0 ou ffff.
  const firstFiveZero = groups.slice(0, 5).every((g) => g === 0);
  if (firstFiveZero && (groups[5] === 0 || groups[5] === 0xffff)) return true;

  // fe80::/10 link-local
  if ((groups[0] & 0xffc0) === 0xfe80) return true;
  // fc00::/7 unique local (fc00:: et fd00::)
  if ((groups[0] & 0xfe00) === 0xfc00) return true;

  return false;
}

function isPrivateAddress(address: string): boolean {
  const a = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (a.includes(":")) return isPrivateIpv6(a);

  const ipv4 = normalizeIpv4(a);
  if (ipv4 !== null) {
    return PRIVATE_IPV4_PATTERNS.some((p) => p.test(ipv4));
  }
  return false;
}

export async function isSafeFetchUrl(rawUrl: string): Promise<boolean> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;

  const hostname = parsed.hostname.toLowerCase().replace(/\.$/, "");
  if (hostname === "localhost") return false;

  const isIpLiteral = /^[\d.]+$/.test(hostname) || hostname.includes(":");
  if (isIpLiteral) {
    return !isPrivateAddress(hostname);
  }

  // Hostname DNS : refuser si l'une des adresses résolues est privée, et
  // refuser par défaut si la résolution échoue (fail-closed).
  try {
    const { lookup } = await import("dns/promises");
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    if (addresses.length === 0) return false;
    return !addresses.some(({ address }) => isPrivateAddress(address));
  } catch {
    return false;
  }
}

// Nombre maximal d'octets lus pour une page/aperçu (anti OOM / anti SSRF
// volumineux). 1 Mo est largement suffisant pour des métadonnées et résumés.
const MAX_FETCH_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;

async function readBodyWithLimit(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) {
    // Corps non streamable (certains runtimes/mocks) : on lit puis on vérifie.
    const text = await res.text();
    if (text.length > MAX_FETCH_BYTES) throw new Error("Réponse trop volumineuse");
    return text;
  }
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_FETCH_BYTES) {
      await reader.cancel();
      throw new Error("Réponse trop volumineuse");
    }
    chunks.push(value);
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    buf.set(c, offset);
    offset += c.byteLength;
  }
  return new TextDecoder("utf-8").decode(buf);
}

// Fetch serveur sûr : chaque saut de redirection est re-vérifié par
// isSafeFetchUrl (anti DNS rebinding et redirect vers IP privée) et le corps
// est limité en taille. Le DNS est résolu par le runtime au moment du fetch :
// c'est le meilleur compromis sans dépendance (undici Agent = variante robuste).
export async function safeFetchText(
  url: string,
  timeoutMs = 8000,
  headers: Record<string, string> = {}
): Promise<string> {
  if (!(await isSafeFetchUrl(url))) {
    throw new Error("URL non autorisée (adresse privée ou invalide)");
  }

  let currentUrl = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await httpRequest(currentUrl, {
      label: "page",
      redirect: "manual",
      timeoutMs,
      // Chaque saut est deja verifie et compte : pas de rejeu automatique.
      retries: 0,
      headers: { "User-Agent": "Mozilla/5.0 (compatible; BACKSTAGE/1.0)", ...headers },
    });

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      if (!location) throw new Error("Redirection sans cible");
      const nextUrl = new URL(location, currentUrl).toString();
      if (!(await isSafeFetchUrl(nextUrl))) {
        throw new Error("Redirection vers une URL non autorisée");
      }
      currentUrl = nextUrl;
      continue;
    }

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return readBodyWithLimit(res);
  }
  throw new Error("Trop de redirections");
}

export async function fetchPageMeta(url: string): Promise<{ title: string; thumbnail?: string }> {
  if (!(await isSafeFetchUrl(url))) {
    return { title: "URL non autorisée (adresse privée ou invalide)" };
  }
  try {
    const ytId = extractYouTubeId(url);
    if (ytId) {
      return {
        title: "",
        thumbnail: `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
      };
    }

    const html = await safeFetchText(url, 5000);
    if (!html) return { title: "Impossible de récupérer la page" };

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const ogTitle = html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i);
    const ogImage = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/i);
    const ogDesc = html.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i);

    return {
      title: ogTitle?.[1]?.trim() ?? titleMatch?.[1]?.trim() ?? "Titre non trouvé",
      thumbnail: ogImage?.[1] || undefined,
      description: ogDesc?.[1]?.trim(),
    } as { title: string; thumbnail?: string; description?: string };
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    const httpStatus = message.match(/^HTTP (\d+)$/);
    if (httpStatus) {
      return { title: `Impossible de récupérer la page (${httpStatus[1]})` };
    }
    return { title: "Erreur de récupération du titre" };
  }
}
