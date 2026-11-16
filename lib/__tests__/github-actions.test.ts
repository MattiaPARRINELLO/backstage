import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

const { createGithubIssue, listGithubIssues, isGithubConfigured, getGithubRepo } = await import(
  "@/lib/github-actions"
);

function ok(body: unknown) {
  return { ok: true, status: 201, statusText: "Created", json: () => Promise.resolve(body) };
}

function fail(status: number, body: unknown) {
  return { ok: false, status, statusText: "Error", json: () => Promise.resolve(body) };
}

describe("github-actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    mockFetch.mockResolvedValueOnce(
      ok({
        number: 42,
        html_url: "https://github.com/MattiaPARRINELLO/backstage/issues/42",
        title: "Bug de rendu",
        state: "open",
        labels: [{ name: "bug" }],
      })
    );

    const issue = await createGithubIssue({
      title: "  Bug de rendu  ",
      body: "Etapes...",
      labels: ["bug", "inconnu"],
    });

    expect(issue.number).toBe(42);
    expect(issue.labels).toEqual(["bug"]);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toBe("https://api.github.com/repos/MattiaPARRINELLO/backstage/issues");
    expect(init.method).toBe("POST");
    const payload = JSON.parse(init.body as string);
    expect(payload.title).toBe("Bug de rendu");
    // Seuls les libelles connus du depot sont transmis.
    expect(payload.labels).toEqual(["bug"]);
    expect(init.headers.Authorization).toBe("Bearer test-token");
  });

  it("refuse un titre ou un corps vide sans appeler l'API", async () => {
    await expect(createGithubIssue({ title: "  ", body: "B" })).rejects.toThrow("Titre");
    await expect(createGithubIssue({ title: "T", body: " " })).rejects.toThrow("Corps");
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("remonte le message d'erreur de l'API sans fuiter le jeton", async () => {
    mockFetch.mockResolvedValueOnce(fail(403, { message: "Resource not accessible" }));
    const err = await createGithubIssue({ title: "T", body: "B" }).then(
      () => null,
      (e: Error) => e
    );
    expect(err).toBeInstanceOf(Error);
    expect(err?.message).toContain("403");
    expect(err?.message).toContain("Resource not accessible");
    expect(err?.message).not.toContain("test-token");
  });

  it("ecarte les pull requests de la liste des issues", async () => {
    mockFetch.mockResolvedValueOnce(
      ok([
        { number: 7, title: "Issue", state: "open", html_url: "u7" },
        { number: 8, title: "PR", state: "open", html_url: "u8", pull_request: {} },
      ])
    );

    const issues = await listGithubIssues({ limit: 5 });

    expect(issues.map((i) => i.number)).toEqual([7]);
    expect(String(mockFetch.mock.calls[0][0])).toContain("per_page=5");
  });
});
