/**
 * Verifie que le nombre de warnings ESLint ne depasse pas le plafond fige.
 *
 * Pourquoi un plafond et pas une erreur directe : `max-lines` (#100) signale
 * aujourd'hui des fichiers qui existaient bien avant la regle. Passer la regle
 * en erreur casserait la CI sur du code qu'on n'a pas touche et decouragerait
 * toute contribution. Le plafond transforme donc l'avertissement en cliquet :
 * il ne peut que descendre, jamais remonter.
 *
 * Regles :
 *   1. une erreur ESLint fait echouer le script, comme `bun run lint` ;
 *   2. plus de warnings que `maxWarnings` fait echouer le script ;
 *   3. moins de warnings que le plafond est accepte, avec un rappel de baisser
 *      le plafond : c'est le travail de la PR qui vient de decouper un fichier.
 *
 * Usage : bun run lint:budget (a lancer via bun pour resoudre le binaire eslint)
 */

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const BUDGET_FILE = path.join(ROOT, "scripts", "eslint-budget.json");

/** Binaire local d'abord : `bunx` peut resoudre une version differente. */
const ESLINT_BIN = existsSync(path.join(ROOT, "node_modules", ".bin", "eslint"))
  ? path.join(ROOT, "node_modules", ".bin", "eslint")
  : "eslint";

type EslintFileResult = {
  filePath: string;
  errorCount: number;
  warningCount: number;
  messages: Array<{ ruleId: string | null; message: string; severity: number }>;
};

type Budget = { maxWarnings: number };

function readBudget(): number {
  const raw = readFileSync(BUDGET_FILE, "utf8");
  const parsed = JSON.parse(raw) as Budget;
  if (!Number.isInteger(parsed.maxWarnings) || parsed.maxWarnings < 0) {
    throw new Error(
      "scripts/eslint-budget.json doit contenir un entier maxWarnings >= 0",
    );
  }
  return parsed.maxWarnings;
}

/** Lance ESLint une seule fois et lit son rapport JSON. */
function runEslint(): EslintFileResult[] {
  try {
    const output = execFileSync(ESLINT_BIN, ["--format", "json"], {
      cwd: ROOT,
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return JSON.parse(output) as EslintFileResult[];
  } catch (error) {
    // ESLint sort en code 1 des qu'il y a une erreur : le rapport reste utile.
    const stdout = (error as { stdout?: string }).stdout;
    if (!stdout) throw error;
    return JSON.parse(stdout) as EslintFileResult[];
  }
}

function relative(filePath: string): string {
  return path.relative(ROOT, filePath) || filePath;
}

const budget = readBudget();
const results = runEslint();

const errors = results.reduce((total, file) => total + file.errorCount, 0);
const warnings = results.reduce((total, file) => total + file.warningCount, 0);

if (errors > 0) {
  console.error(`[lint-budget] ${errors} erreur(s) ESLint, corriger avant tout.`);
  for (const file of results) {
    for (const message of file.messages) {
      if (message.severity === 2) {
        console.error(`  ${relative(file.filePath)}: ${message.message}`);
      }
    }
  }
  process.exit(1);
}

if (warnings > budget) {
  console.error(
    `[lint-budget] ${warnings} warnings > plafond ${budget}. ` +
      "Decouper le fichier signale, ou justifier l'exception par ecrit.",
  );
  for (const file of results) {
    if (file.warningCount > 0) {
      console.error(
        `  ${relative(file.filePath)} (${file.warningCount}) : ` +
          file.messages.map((m) => m.ruleId ?? "?").join(", "),
      );
    }
  }
  process.exit(1);
}

if (warnings < budget) {
  console.warn(
    `[lint-budget] ${warnings} warnings, plafond ${budget} : ` +
      `baisser maxWarnings a ${warnings} dans scripts/eslint-budget.json.`,
  );
}

console.log(`[lint-budget] ${warnings}/${budget} warnings, 0 erreur.`);
