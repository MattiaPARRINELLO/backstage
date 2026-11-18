import { z } from "zod";
import { defineTool, toolEmpty, toolError, toolOk } from "@backstage/module-kit";

import {
  GITHUB_ISSUE_LABELS,
  createGithubIssue,
  getGithubRepo,
  isGithubConfigured,
  listGithubIssues,
} from "@/lib/github-actions";

/**
 * Issues GitHub du depot fixe par `GITHUB_REPO`.
 *
 * `create_issue` est un effet `external`, mais sans confirmation explicite :
 * c'est le comportement historique, le depot et le jeton sont deja bornes. Le
 * module peut retirer la confirmation par defaut (ADR 0001, decision D), pas
 * le noyau.
 */

const NOT_CONFIGURED =
  "GitHub non configure : GITHUB_TOKEN et GITHUB_REPO doivent etre definis dans .env.local.";

export const createGithubIssueTool = defineTool({
  name: "create_issue",
  description:
    "Ouvre une issue sur le depot GitHub du projet Backstage. Utilise-la quand l'utilisateur te demande d'ouvrir/creer une issue, de signaler un bug, ou quand il rapporte un dysfonctionnement de Backstage qu'il veut faire tracer. " +
    "Pour un bug, le corps doit contenir : ce qui se passe, ce qui etait attendu, les etapes de reproduction, et les infos de debug disponibles (message d'erreur exact, page/route concernee, heure, navigateur ou appareil). " +
    "Pour une fonctionnalite, le corps doit contenir : le besoin, le comportement souhaite et la valeur attendue. " +
    "Renseigne les libelles : 'bug' pour un dysfonctionnement, 'enhancement' pour une fonctionnalite, 'documentation' pour la doc. " +
    "L'issue est publiee immediatement, sans confirmation : annonce toujours l'URL renvoyee et ne l'invente jamais.",
  params: z.object({
    title: z.string().trim().min(1, "Titre de l'issue requis"),
    body: z.string().trim().min(1, "Corps de l'issue requis"),
    labels: z.array(z.enum(GITHUB_ISSUE_LABELS)).optional(),
  }),
  sideEffect: "external",
  requiresConfirmation: false,
  run: async (args) => {
    if (!isGithubConfigured()) return toolError(NOT_CONFIGURED);

    const issue = await createGithubIssue({
      title: args.title,
      body: args.body,
      labels: args.labels,
    });
    const repo = getGithubRepo() ?? "le depot configure";
    const labels = issue.labels.length > 0 ? `\nLibelles : ${issue.labels.join(", ")}` : "";
    return toolOk(
      `Issue #${issue.number} creee sur ${repo} : ${issue.title}\n${issue.url}${labels}`
    );
  },
});

export const listGithubIssuesTool = defineTool({
  name: "list_issues",
  description:
    "Liste les issues recentes du depot GitHub du projet Backstage (numero, titre, etat, libelles). Utilise-la avant create_github_issue pour eviter un doublon, ou quand l'utilisateur demande ce qui est deja ouvert.",
  params: z.object({
    state: z.enum(["open", "closed", "all"]).optional(),
    limit: z.number().int().min(1).max(30).optional(),
  }),
  sideEffect: "read",
  trust: "untrusted",
  run: async (args) => {
    if (!isGithubConfigured()) return toolError(NOT_CONFIGURED);

    const state = args.state ?? "open";
    const issues = await listGithubIssues({ state, limit: args.limit });
    const repo = getGithubRepo() ?? "le depot configure";
    if (issues.length === 0) return toolEmpty(`Aucune issue ${state} sur ${repo}.`);

    return toolOk(
      issues
        .map(
          (issue) =>
            `- #${issue.number} [${issue.state}] ${issue.title}${
              issue.labels.length > 0 ? ` (${issue.labels.join(", ")})` : ""
            }`
        )
        .join("\n")
    );
  },
});
