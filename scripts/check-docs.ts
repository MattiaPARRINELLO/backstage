/**
 * Verifie que les references de fichiers de la documentation se resolvent.
 *
 * Une reference morte dans un guide de contribution envoie le lecteur dans un
 * fichier inexistant, au moment precis ou il essaie de comprendre. Apres le
 * refactor modulaire (#84), les chemins vont bouger : ce script transforme la
 * derive documentaire en echec de CI.
 *
 * Regles de resolution, ecrites ici parce qu'un verificateur naif produit des
 * faux positifs :
 *   1. chemin avec `/` (relatif ou absolu depuis la racine) : resolution
 *      directe, puis relative au fichier source pour les liens Markdown ;
 *   2. nom de fichier seul (`ChatView.tsx`) : succes si au moins un fichier du
 *      depot porte ce nom ;
 *   3. prefixe `data/` : ignore, le dossier est gitignore et absent d'un clone ;
 *   4. placeholders (`PascalCase.tsx`, `kebab-case.ts`, `MonComposant.tsx`,
 *      motifs a chevrons ou etoiles) : ignores via la liste explicite ci-dessous ;
 *   5. lien Markdown relatif (`../design.md`) : resolu depuis le fichier source.
 *
 * Usage : bun run check:docs
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

// ============================================================
// Exceptions — une seule liste, commentee, jamais dispersee
// ============================================================

/** Dossiers absents d'un clone : `data/` est gitignore et contient des secrets. */
const IGNORED_PREFIXES = ["data/"];

/**
 * Fichiers cites par la documentation mais produits au deploiement, donc
 * absents du depot : `server.js` est genere par `output: "standalone"` et
 * declare comme fichier de demarrage cPanel.
 */
const GENERATED_FILES = new Set(["server.js", "local.properties"]);

/**
 * Noms de fichiers du store `data/` cites sans prefixe (`users.json`,
 * `chat-history.json`). Le dossier est gitignore : impossible de les resoudre,
 * et les citer est legitime quand la phrase parle du contenu du store.
 */
const DATA_FILES = new Set([
  "accreditations.json",
  "activity.json",
  "chat-history.json",
  "concerts.json",
  "config.json",
  "consent.json",
  "demo-calls.json",
  "emails.json",
  "fcm-devices.json",
  "fcm-pair-codes.json",
  "gallery.json",
  "intentions.json",
  "leetcode.json",
  "live-notifs.json",
  "memory.json",
  "notified-briefs.json",
  "passkey-pair-codes.json",
  "photo-shoots.json",
  "push-subscriptions.json",
  "reminders.json",
  "schedule.json",
  "server-cache.json",
  "users.json",
  "watch-later.json",
]);

/**
 * Documents prospectifs : la roadmap decrit des fichiers qui n'existent pas
 * encore. Les verifier ferait echouer la CI a chaque proposition d'architecture.
 */
const FUTURE_DOCS = new Set(["docs/roadmap-multi-utilisateurs.md"]);

/** Routes d'infrastructure servies par reecriture, pas par un fichier du depot. */
const INFRASTRUCTURE_PATHS = new Set(["/.well-known/assetlinks.json"]);

/**
 * Placeholders et motifs de nommage : ils decrivent une convention, pas un
 * fichier. Toute autre valeur non resolue est une erreur.
 */
const PLACEHOLDERS = new Set([
  "PascalCase.tsx",
  "kebab-case.ts",
  "MonComposant.tsx",
  "components/<categorie>/MonComposant.tsx",
  "components/<catégorie>/MonComposant.tsx",
  "app/api/mon-domaine/route.ts",
  "./scripts/*.sh",
]);

/** Motifs qui ne peuvent pas designers un fichier precis. */
const PLACEHOLDER_PATTERNS = [
  /[<>*]/, // `components/<categorie>/X.tsx`, `*.ts`
  /^\.env(\..*)?$/, // `.env.local`, `.env.example` : jamais dans le depot
  /^process\.env$/,
  /^[a-z-]+\.[a-z]+\.[a-z]+$/, // `PUBLIC_DEMO.after.note`
  /(^|\/)\.\.\.(\/|$)/, // `.../MainActivity.java` : chemin abrege volontairement
];

/** Extensions considerees comme des fichiers quand elles apparaissent seules. */
const FILE_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "json",
  "md",
  "css",
  "yml",
  "yaml",
  "sh",
  "java",
  "kt",
  "kts",
  "gradle",
  "xml",
  "toml",
  "lock",
  "example",
  "properties",
  "txt",
  "html",
  "svg",
  "png",
  "jpg",
  "jpeg",
  "webp",
  "ico",
  "webmanifest",
  "conf",
]);

/** `fichier.ts:42` ou `fichier.ts:42-58` : la ligne n'appartient pas au chemin. */
const LINE_SUFFIX = /:\d+(?:-\d+)?$/;

export interface DocSource {
  /** Chemin du document, relatif a la racine du depot. */
  path: string;
  content: string;
}

export interface DocError {
  source: string;
  line: number;
  reference: string;
  suggestion?: string;
}

export interface DocSkip {
  source: string;
  line: number;
  reference: string;
  reason: "data" | "placeholder" | "generated" | "future-doc" | "infrastructure" | "ignored";
}

export interface CheckDocsResult {
  checked: number;
  errors: DocError[];
  skipped: DocSkip[];
}

interface ExtractedReference {
  line: number;
  reference: string;
  /** Un lien Markdown se resout depuis le fichier source, pas depuis la racine. */
  fromSourceDir: boolean;
}

/**
 * Extrait les references d'un document : blocs de code inline entre backticks
 * et cibles de liens Markdown relatifs.
 */
export function extractReferences(content: string): ExtractedReference[] {
  const references: ExtractedReference[] = [];
  const lines = content.split("\n");

  lines.forEach((text, index) => {
    const line = index + 1;

    for (const match of text.matchAll(/`([^`\n]+)`/g)) {
      const raw = match[1].trim();
      const reference = raw.replace(LINE_SUFFIX, "");
      if (!reference) continue;
      references.push({ line, reference, fromSourceDir: false });
    }

    for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)) {
      const target = match[1].trim();
      if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|#)/i.test(target)) continue; // http, mailto, ancre
      const [withoutAnchor] = target.split("#");
      if (!withoutAnchor) continue;
      references.push({ line, reference: decodeURI(withoutAnchor), fromSourceDir: true });
    }
  });

  return references;
}

/** Vrai si le token ressemble a un nom de fichier verifiable. */
export function looksLikeFilePath(reference: string): boolean {
  if (/[\s:]/.test(reference)) return false; // commande shell, `fichier:ligne` residuel
  const basename = reference.split("/").pop() ?? "";
  if (!basename.includes(".")) return false;
  const extension = basename.split(".").pop()?.toLowerCase() ?? "";
  return FILE_EXTENSIONS.has(extension);
}

function isIgnored(reference: string): DocSkip["reason"] | null {
  if (PLACEHOLDERS.has(reference)) return "placeholder";
  if (PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(reference))) return "placeholder";
  if (IGNORED_PREFIXES.some((prefix) => reference.startsWith(prefix))) return "data";
  if (DATA_FILES.has(reference)) return "data";
  if (INFRASTRUCTURE_PATHS.has(reference)) return "infrastructure";
  if (GENERATED_FILES.has(path.posix.basename(reference))) return "generated";
  return null;
}

/** Distance de Levenshtein, bornee : sert uniquement a suggerer un fichier proche. */
function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    let last = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const current = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        last + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      last = current;
    }
  }
  return previous[b.length];
}

/** Fichier le plus proche : meme nom d'abord, puis distance d'edition minimale. */
export function suggestFile(reference: string, files: string[]): string | undefined {
  const wanted = path.posix.basename(reference);
  const sameName = files.filter((file) => path.posix.basename(file) === wanted);
  if (sameName.length === 1) return sameName[0];
  if (sameName.length > 1) {
    return sameName.sort((a, b) => a.length - b.length)[0];
  }

  let best: { file: string; distance: number } | undefined;
  for (const file of files) {
    const distance = editDistance(reference, file);
    if (!best || distance < best.distance) best = { file, distance };
  }
  if (!best) return undefined;
  // Une suggestion trop lointaine n'aide pas : on se tait.
  return best.distance <= Math.max(4, Math.ceil(reference.length / 3)) ? best.file : undefined;
}

/**
 * Candidats de resolution pour une reference contenant `/` :
 *  - chemin depuis la racine ;
 *  - relatifs au fichier source pour un lien Markdown ;
 *  - URL absolue servie depuis `public/` ou par une route `app/<chemin>/route.ts`.
 */
function resolveCandidates(
  reference: string,
  sourceDir: string,
  fromSourceDir: boolean
): string[] {
  const candidates: string[] = [];
  const normalized = path.posix.normalize(reference.replace(/^\/+/, ""));
  candidates.push(normalized);

  if (fromSourceDir) {
    candidates.push(path.posix.normalize(path.posix.join(sourceDir, reference)));
  }

  if (reference.startsWith("/")) {
    candidates.push(path.posix.join("public", normalized));
    candidates.push(path.posix.join("app", normalized, "route.ts"));
  }

  return [...new Set(candidates)];
}

/**
 * Verifie toutes les references. Les fichiers passes sont les chemins du depot
 * (sortie de `git ls-files`), ce qui rend la fonction testable sans disque.
 */
export function checkDocs(
  docs: DocSource[],
  files: string[],
  isIgnoredPath: (candidate: string) => boolean = () => false
): CheckDocsResult {
  const fileSet = new Set(files);
  const byBasename = new Map<string, string[]>();
  for (const file of files) {
    const basename = path.posix.basename(file);
    const list = byBasename.get(basename);
    if (list) list.push(file);
    else byBasename.set(basename, [file]);
  }

  // Les noms de fichiers de donnees cites avec `data/` restent ignores meme
  // quand ils apparaissent seuls (`users.json`, `chat-history.json`).
  const dataFileNames = new Set<string>();
  for (const doc of docs) {
    for (const { reference } of extractReferences(doc.content)) {
      if (IGNORED_PREFIXES.some((prefix) => reference.startsWith(prefix))) {
        dataFileNames.add(path.posix.basename(reference));
      }
    }
  }

  const errors: DocError[] = [];
  const skipped: DocSkip[] = [];
  let checked = 0;

  for (const doc of docs) {
    if (FUTURE_DOCS.has(doc.path)) {
      skipped.push({ source: doc.path, line: 0, reference: doc.path, reason: "future-doc" });
      continue;
    }

    const sourceDir = path.posix.dirname(doc.path);

    for (const { line, reference, fromSourceDir } of extractReferences(doc.content)) {
      if (!looksLikeFilePath(reference)) continue;

      const ignored = isIgnored(reference);
      if (ignored) {
        skipped.push({ source: doc.path, line, reference, reason: ignored });
        continue;
      }

      const isBareName = !reference.includes("/");
      if (isBareName && dataFileNames.has(reference)) {
        skipped.push({ source: doc.path, line, reference, reason: "data" });
        continue;
      }

      checked += 1;

      if (isBareName) {
        if (byBasename.has(reference)) continue;
      } else {
        const candidates = resolveCandidates(reference, sourceDir, fromSourceDir);
        if (candidates.some((candidate) => fileSet.has(candidate))) continue;
        // Fichier gitignore (secrets, donnees locales) : absent d'un clone, mais
        // sa presence sur le disque de l'auteur est la verification possible.
        if (candidates.some((candidate) => isIgnoredPath(candidate))) {
          skipped.push({ source: doc.path, line, reference, reason: "ignored" });
          checked -= 1;
          continue;
        }
      }

      errors.push({
        source: doc.path,
        line,
        reference,
        suggestion: suggestFile(reference, files),
      });
    }
  }

  return { checked, errors, skipped };
}

/** Charge documents et fichiers du depot via git, sans parcourir `node_modules`. */
export function loadRepository(root: string): { docs: DocSource[]; files: string[] } {
  const files = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  const docs = files
    .filter((file) => file.endsWith(".md"))
    .map((file) => ({ path: file, content: readFileSync(path.join(root, file), "utf8") }));
  return { docs, files };
}

function main(): number {
  const root = process.cwd();
  if (!existsSync(path.join(root, ".git"))) {
    console.error("[check-docs] lancer depuis la racine du depot");
    return 1;
  }

  const { docs, files } = loadRepository(root);
  const ignoreCache = new Map<string, boolean>();
  const isIgnoredPath = (candidate: string): boolean => {
    const cached = ignoreCache.get(candidate);
    if (cached !== undefined) return cached;
    let ignored = false;
    try {
      execFileSync("git", ["check-ignore", "-q", "--no-index", candidate], { cwd: root });
      ignored = true;
    } catch {
      ignored = false;
    }
    ignoreCache.set(candidate, ignored);
    return ignored;
  };

  const { checked, errors, skipped } = checkDocs(docs, files, isIgnoredPath);

  if (errors.length > 0) {
    for (const error of errors) {
      const suggestion = error.suggestion ? ` (le plus proche : ${error.suggestion})` : "";
      console.error(
        `[check-docs] ${error.source}:${error.line} reference introuvable : ${error.reference}${suggestion}`
      );
    }
    console.error(
      `[check-docs] ${errors.length} reference(s) morte(s) sur ${checked} verifiee(s).`
    );
    return 1;
  }

  const ignored = skipped.length > 0 ? `, ${skipped.length} ignoree(s)` : "";
  console.log(`[check-docs] ${checked} reference(s) verifiee(s)${ignored}, aucune morte.`);
  return 0;
}

// Execute uniquement en CLI : les tests importent les fonctions sans lancer `main`.
const entryPoint = process.argv[1];
if (entryPoint && import.meta.url === pathToFileURL(entryPoint).href) {
  process.exit(main());
}
