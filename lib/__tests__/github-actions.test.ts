import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { jsonResponse, withHttpDouble } from "@/lib/http-double";

const { createGithubIssue, listGithubIssues, isGithubConfigured, getGithubRepo } = await import(
  "@/lib/github-actions"
);

const REPO_URL = "https://api.github.com/repos/MattiaPARRINELLO/backstage";

describe("github-actions", () => {
  beforeEach(() => {
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_REPO = "MattiaPARRINELLO/backstage";
  });

  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_REPO;
  });

  it("signale une configuration absente", async () => {
    delete process.env.GITHUB_TOKEN;
    expect(isGithubConfigured()).toBe(false);
    await expect(createGithubIssue({ title: "T", body: "B" })).rejects.toThrow("GITHUB_TOKEN");
  });

  it("rejette un GITHUB_REPO mal forme", async () => {
    process.env.GITHUB_REPO = "backstage";
    expect(getGithubRepo()).toBeNull();
    await expect(createGithubIssue({ title: "T", body: "B" })).rejects.toThrow("GITHUB_REPO");
  });

  it("cree une issue sur le depot configure", async () => {
    await withHttpDouble(
      [
        {
          match: `${REPO_URL}/issues`,
          response: jsonResponse(
            {
              number: 42,
              html_url: "https://github.com/MattiaPARRINELLO/backstage/issues/42",
              title: "Bug de rendu",
              state: "open",
              labels: [{ name: "bug" }],
            },
            { status: 201 }
          ),
        },
      ],
      async (double) => {
        const issue = await createGithubIssue({
          title: "  Bug de rendu  ",
          body: "Etapes...",
          labels: ["bug", "inconnu"],
        });

        expect(issue.number).toBe(42);
        expect(issue.labels).toEqual(["bug"]);
        const call = double.calls[0];
        expect(call?.url).toBe(`${REPO_URL}/issues`);
        expect(call?.init.method).toBe("POST");
        const payload = JSON.parse(call?.init.body as string);
        expect(payload.title).toBe("Bug de rendu");
        // Seuls les libelles connus du depot sont transmis.
        expect(payload.labels).toEqual(["bug"]);
        expect((call?.init.headers as Record<string, string>).Authorization).toBe(
          "Bearer test-token"
        );
      }
    );
  });

  it("refuse un titre ou un corps vide sans appeler l'API", async () => {
    await withHttpDouble([], async (double) => {
      await expect(createGithubIssue({ title: "  ", body: "B" })).rejects.toThrow("Titre");
      await expect(createGithubIssue({ title: "T", body: " " })).rejects.toThrow("Corps");
      expect(double.calls).toHaveLength(0);
    });
  });

  it("remonte le message d'erreur de l'API sans fuiter le jeton", async () => {
    await withHttpDouble(
      [
        {
          match: `${REPO_URL}/issues`,
          response: jsonResponse({ message: "Resource not accessible" }, { status: 403 }),
        },
      ],
      async () => {
        const err = await createGithubIssue({ title: "T", body: "B" }).then(
          () => null,
          (e: Error) => e
        );
        expect(err).toBeInstanceOf(Error);
        expect(err?.message).toContain("403");
        expect(err?.message).toContain("Resource not accessible");
        expect(err?.message).not.toContain("test-token");
      }
    );
  });

  it("ecarte les pull requests de la liste des issues", async () => {
    await withHttpDouble(
      [
        {
          match: /\/repos\/[^/]+\/[^/]+\/issues\?/,
          response: jsonResponse([
            { number: 7, title: "Issue", state: "open", html_url: "u7" },
            { number: 8, title: "PR", state: "open", html_url: "u8", pull_request: {} },
          ]),
        },
      ],
      async (double) => {
        const issues = await listGithubIssues({ limit: 5 });

        expect(issues.map((i) => i.number)).toEqual([7]);
        expect(double.calls[0]?.url).toContain("per_page=5");
      }
    );
  });
});
