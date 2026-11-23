/**
 * Racine de composition `modules/index.ts` : import du module et entree du
 * tableau. Les deux operations sont symetriques, sans regex sur tout le fichier.
 */

function identifierFor(id: string): string {
  return id.replace(/-([a-z0-9])/g, (_, letter: string) => letter.toUpperCase());
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

const ARRAY_PATTERN =
  /(export const modules: readonly ModuleDefinition\[\] = \[)([\s\S]*?)(\];)/;

/** Ajoute l'import et l'entree du module dans la racine de composition. */
export function addToComposition(source: string, id: string): string {
  if (source.includes(`"./${id}/module"`)) return source;

  const ident = identifierFor(id);
  const importLine = `import ${ident} from "./${id}/module";`;

  const importLines = [...source.matchAll(/^import .*;$/gm)];
  const lastImport = importLines.at(-1);
  let next = source;
  if (lastImport?.index !== undefined) {
    const insertAt = lastImport.index + lastImport[0].length;
    next = `${source.slice(0, insertAt)}\n${importLine}${source.slice(insertAt)}`;
  } else {
    next = `${importLine}\n${source}`;
  }

  if (!ARRAY_PATTERN.test(next)) {
    throw new Error("Racine de composition invalide : tableau `modules` introuvable.");
  }
  return next.replace(ARRAY_PATTERN, (_match, start: string, entries: string, end: string) => {
    const trimmed = entries.trim();
    const separator = trimmed.length > 0 ? ", " : "";
    return `${start}${trimmed}${separator}${ident}${end}`;
  });
}

/** Retire l'import et l'entree du module : symetrique de `addToComposition`. */
export function removeFromComposition(source: string, id: string): string {
  const specifier = `"./${id}/module"`;
  const ident = identifierFor(id);

  // `addToComposition` ecrit l'import sur une seule ligne : on retire la ligne
  // et le saut de ligne qui la precede, pour revenir au source d'origine.
  const importPattern = new RegExp(`\\nimport [^\\n]*from ${escapeRegExp(specifier)};`);
  let next = source;
  if (importPattern.test(source)) {
    next = source.replace(importPattern, "");
  } else {
    const firstLinePattern = new RegExp(
      `^import [^\\n]*from ${escapeRegExp(specifier)};\\n`,
      "m"
    );
    next = source.replace(firstLinePattern, "");
  }

  if (!ARRAY_PATTERN.test(next)) {
    throw new Error("Racine de composition invalide : tableau `modules` introuvable.");
  }
  return next.replace(ARRAY_PATTERN, (_match, start: string, entries: string, end: string) => {
    const kept = entries
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0 && entry !== ident);
    return `${start}${kept.join(", ")}${end}`;
  });
}
