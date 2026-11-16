/**
 * Fusion d'un fichier `.env.local` avec les cles gerees par `bun run setup`.
 *
 * Module pur : prend le contenu existant et une liste de cles gerees, renvoie
 * le nouveau contenu. Les lignes inconnues (variables ajoutees a la main,
 * commentaires, sections optionnelles) sont conservees telles quelles.
 */

export interface ManagedEnvEntry {
  /** Nom de la variable, par exemple AUTH_SECRET. */
  key: string;
  /** Section affichee quand la cle doit etre ajoutee. */
  block: string;
  /** Commentaire par defaut ajoute a droite de la valeur. */
  comment: string;
  /** Valeur generee quand la cle est absente ou vide. Absent = cle manuelle. */
  generate?: () => string | undefined;
}

export interface MergeEnvResult {
  content: string;
  /** Cles nouvellement generees ou remplies. */
  created: string[];
  /** Cles deja renseignees, laissees intactes. */
  kept: string[];
}

interface ParsedLine {
  key: string;
  value: string;
  comment: string | null;
}

function parseEnvLine(line: string): ParsedLine | null {
  const match = /^([A-Za-z0-9_]+)=(.*)$/.exec(line);
  if (!match) return null;

  const rest = match[2];
  const commentMatch = /^(.*?)\s+#\s*(.*)$/.exec(rest);
  const value = (commentMatch ? commentMatch[1] : rest).trim();
  const comment = commentMatch ? commentMatch[2].trim() : null;
  return { key: match[1], value, comment };
}

function formatLine(key: string, value: string, comment: string | null): string {
  return comment ? `${key}=${value}   # ${comment}` : `${key}=${value}`;
}

function blockSeparator(title: string): string {
  return `\n# ────────────────────────────────────────────────────────────────────\n# ${title}\n# ────────────────────────────────────────────────────────────────────\n`;
}

/**
 * Reecrit uniquement les cles presentes dans `entries`.
 *
 * - une cle geree deja renseignee garde sa valeur et son commentaire ;
 * - une cle geree vide est remplie si `generate` existe, sinon laissee vide ;
 * - une cle geree absente est ajoutee dans sa section ;
 * - toute autre ligne (variable inconnue, commentaire, ligne vide) est
 *   recopiee a l'identique.
 */
export function mergeEnvFile(
  existingContent: string | null,
  entries: ManagedEnvEntry[],
  header: string
): MergeEnvResult {
  const byKey = new Map(entries.map((entry) => [entry.key, entry]));
  const created: string[] = [];
  const kept: string[] = [];
  const seen = new Set<string>();
  const out: string[] = [];

  if (existingContent === null) {
    out.push(...header.split("\n"));
  } else {
    for (const line of existingContent.split("\n")) {
      const parsed = parseEnvLine(line);
      const entry = parsed ? byKey.get(parsed.key) : undefined;

      if (parsed && entry) {
        // Doublon dans le fichier : la premiere occurrence gagne.
        if (seen.has(parsed.key)) continue;
        seen.add(parsed.key);

        if (parsed.value.length > 0) {
          kept.push(parsed.key);
          out.push(formatLine(parsed.key, parsed.value, parsed.comment ?? entry.comment));
          continue;
        }

        const generated = entry.generate?.();
        if (generated) created.push(parsed.key);
        out.push(formatLine(parsed.key, generated ?? "", parsed.comment ?? entry.comment));
        continue;
      }

      out.push(line);
    }
  }

  const missing = entries.filter((entry) => !seen.has(entry.key));
  if (missing.length > 0) {
    // Pas de suite de lignes vides avant le bloc ajoute.
    while (out.length > 0 && out[out.length - 1].trim() === "") out.pop();

    let lastBlock = "";
    for (const entry of missing) {
      if (entry.block !== lastBlock) {
        out.push(blockSeparator(entry.block).replace(/\n$/, ""));
        lastBlock = entry.block;
      }
      const generated = entry.generate?.();
      if (generated) created.push(entry.key);
      out.push(formatLine(entry.key, generated ?? "", entry.comment));
    }
    out.push("");
  }

  return { content: out.join("\n"), created, kept };
}
