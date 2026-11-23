import type { ModuleContext } from "@backstage/module-kit";

export interface PageSummary {
  readonly summary: string;
  readonly tags: readonly string[];
}

const EMPTY: PageSummary = { summary: "", tags: [] };

const SYSTEM_PROMPT =
  'Tu analyses du contenu web en français. Réponds UNIQUEMENT au format JSON : {"summary": "résumé en 1-2 phrases", "tags": ["tag1","tag2","tag3"]}';

/**
 * Resume d'une page pour un lien garde.
 *
 * Le module ne touche ni au reseau ni au fournisseur IA directement : il passe
 * par `ctx.net` (protection anti-SSRF du noyau) et `ctx.ai` (modele applicatif).
 * Sans ces capacites, ou si la page est refusee, il rend un resume vide plutot
 * que de faire echouer l'ajout du lien.
 */
export async function summarizePage(
  ctx: ModuleContext,
  url: string,
  title: string
): Promise<PageSummary> {
  if (!ctx.net || !ctx.ai) return EMPTY;
  if (!(await ctx.net.isSafeUrl(url))) return EMPTY;

  const html = await ctx.net.fetchText(url, 8000);
  if (!html) return EMPTY;

  const text = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&[a-z]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 3000);
  if (!text) return EMPTY;

  try {
    const raw = await ctx.ai.complete({
      system: SYSTEM_PROMPT,
      prompt: `Titre: ${title}\n\nContenu:\n${text}`,
      maxChars: 2000,
    });
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as { summary?: string; tags?: string[] };
      return {
        summary: parsed.summary?.trim() ?? "",
        tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 5) : [],
      };
    }
    return { summary: raw.slice(0, 200).trim(), tags: [] };
  } catch {
    return EMPTY;
  }
}
