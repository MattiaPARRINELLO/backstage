import { beforeEach, describe, expect, it, vi } from "vitest";

const github = {
  GITHUB_ISSUE_LABELS: ["bug", "enhancement", "documentation"] as const,
  createGithubIssue: vi.fn(),
  listGithubIssues: vi.fn(),
  getGithubRepo: vi.fn(() => "owner/repo"),
  isGithubConfigured: vi.fn(() => true),
};

vi.mock("@/lib/github-actions", () => github);

const { createGithubIssueTool, listGithubIssuesTool } = await import("@/modules/github/tools");

const ctx = { moduleId: "github", log: () => {}, emit: () => {} };

describe("outils GitHub", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    github.isGithubConfigured.mockReturnValue(true);
  });

  it("cree une issue et annonce l'URL renvoyee", async () => {
    github.createGithubIssue.mockResolvedValue({
      number: 12,
      url: "https://github.com/owner/repo/issues/12",
      title: "Bug de sync",
      state: "open",
      labels: ["bug"],
    });

    const result = await createGithubIssueTool.run(
      { title: "Bug de sync", body: "Etapes", labels: ["bug"] },
      ctx
    );

    expect(result.status).toBe("ok");
    expect(result.text).toContain("#12");
    expect(result.text).toContain("https://github.com/owner/repo/issues/12");
  });

  it("signale une configuration absente", async () => {
    github.isGithubConfigured.mockReturnValue(false);
    const result = await createGithubIssueTool.run({ title: "T", body: "B" }, ctx);
    expect(result.status).toBe("error");
    expect(result.text).toContain("GitHub non configure");
    expect(github.createGithubIssue).not.toHaveBeenCalled();
  });

  it("liste les issues", async () => {
    github.listGithubIssues.mockResolvedValue([
      { number: 3, url: "", title: "Idee", state: "open", labels: ["enhancement"] },
    ]);

    const result = await listGithubIssuesTool.run({}, ctx);
    expect(result.status).toBe("ok");
    expect(result.text).toContain("#3 [open] Idee (enhancement)");
  });

  it("rend un resultat vide quand aucune issue ne correspond", async () => {
    github.listGithubIssues.mockResolvedValue([]);
    const result = await listGithubIssuesTool.run({ state: "closed" }, ctx);
    expect(result.status).toBe("empty");
    expect(result.text).toContain("Aucune issue closed");
  });

  it("exige un titre et un corps", () => {
    expect(createGithubIssueTool.params.safeParse({ title: "", body: "B" }).success).toBe(false);
    expect(createGithubIssueTool.params.safeParse({ title: "T", body: "" }).success).toBe(false);
  });
});
