// Client GitHub minimal pour les issues. Volontairement limité à un seul dépôt,
// fixé par `GITHUB_REPO` : le modèle ne choisit jamais la cible d'une écriture
// externe, sinon un contenu injecté (email, page web) pourrait la détourner.
const API_BASE = "https://api.github.com";
const TIMEOUT_MS = 15_000;

// Libellés acceptés. Le modèle devine parfois des libellés inexistants sur le
// dépôt, ce qui fait échouer la création : on restreint à ceux qui existent.
export const GITHUB_ISSUE_LABELS = ["bug", "enhancement", "documentation"] as const;
export type GithubIssueLabel = (typeof GITHUB_ISSUE_LABELS)[number];

export interface GithubIssue {
  number: number;
  url: string;
  title: string;
  state: string;
  labels: string[];
}

interface GithubConfig {
  token: string;
  repo: string;
}

function readConfig(): GithubConfig {
  const token = process.env.GITHUB_TOKEN?.trim();
  const repo = process.env.GITHUB_REPO?.trim();
  if (!token || !repo) {
    throw new Error(
      "GitHub non configure : definis GITHUB_TOKEN et GITHUB_REPO (owner/nom) dans .env.local."
    );
  }
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    throw new Error("GITHUB_REPO invalide : format attendu owner/nom.");
  }
  return { token, repo };
}

export function isGithubConfigured(): boolean {
  return Boolean(process.env.GITHUB_TOKEN?.trim() && process.env.GITHUB_REPO?.trim());
}

export function getGithubRepo(): string | null {
  const repo = process.env.GITHUB_REPO?.trim();
  return repo && /^[\w.-]+\/[\w.-]+$/.test(repo) ? repo : null;
}

interface ApiIssue {
  number?: number;
  html_url?: string;
  title?: string;
  state?: string;
  message?: string;
  labels?: { name?: string }[];
}

function toIssue(raw: ApiIssue): GithubIssue {
  return {
    number: raw.number ?? 0,
    url: raw.html_url ?? "",
    title: raw.title ?? "",
    state: raw.state ?? "open",
    labels: (raw.labels ?? []).map((l) => l.name ?? "").filter(Boolean),
  };
}

async function githubRequest(path: string, init: RequestInit = {}): Promise<unknown> {
  const { token, repo } = readConfig();
  let response: Response;
  try {
    response = await fetch(`${API_BASE}/repos/${repo}${path}`, {
      ...init,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "backstage-agent",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
      },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (err) {
    throw new Error(
      `GitHub injoignable (${err instanceof Error ? err.message : String(err)}).`
    );
  }

  if (!response.ok) {
    // Le message de l'API est utile (scope manquant, libellé inconnu) mais ne
    // doit jamais contenir le token : il vient du corps de la réponse.
    let detail = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as ApiIssue;
      if (body?.message) detail += ` - ${body.message}`;
    } catch {
      // Corps non JSON : le statut suffit.
    }
    throw new Error(`GitHub a refuse la requete (${detail}).`);
  }

  return response.json().catch(() => null);
}

function normalizeLabels(labels: unknown): GithubIssueLabel[] {
  if (!Array.isArray(labels)) return [];
  const wanted = labels.map((l) => String(l).toLowerCase().trim());
  return GITHUB_ISSUE_LABELS.filter((l) => wanted.includes(l));
}

export async function createGithubIssue(input: {
  title: string;
  body?: string;
  labels?: unknown;
}): Promise<GithubIssue> {
  const title = input.title?.trim();
  if (!title) throw new Error("Titre de l'issue requis.");
  const body = input.body?.trim();
  if (!body) throw new Error("Corps de l'issue requis.");
  readConfig();

  const labels = normalizeLabels(input.labels);
  const payload: Record<string, unknown> = { title, body };
  if (labels.length > 0) payload.labels = labels;

  const raw = (await githubRequest("/issues", {
    method: "POST",
    body: JSON.stringify(payload),
  })) as ApiIssue | null;

  if (!raw?.number) throw new Error("GitHub n'a pas renvoye d'issue exploitable.");
  return toIssue(raw);
}

export async function listGithubIssues(
  options: { state?: "open" | "closed" | "all"; limit?: number } = {}
): Promise<GithubIssue[]> {
  readConfig();
  const state = options.state ?? "open";
  const limit = Math.min(Math.max(options.limit ?? 10, 1), 30);
  const query = new URLSearchParams({
    state,
    per_page: String(limit),
    sort: "created",
    direction: "desc",
  });
  const raw = await githubRequest(`/issues?${query.toString()}`, { method: "GET" });
  if (!Array.isArray(raw)) return [];
  // L'API renvoie aussi les pull requests dans /issues : on les écarte.
  return raw
    .filter((item) => !("pull_request" in (item as Record<string, unknown>)))
    .map((item) => toIssue(item as ApiIssue))
    .filter((issue) => issue.number > 0);
}
