import { describe, expect, it } from "vitest";
import { mergeEnvFile, type ManagedEnvEntry } from "../env-file";

const HEADER = "# entete\n";

function entries(overrides: Partial<ManagedEnvEntry>[] = []): ManagedEnvEntry[] {
  const base: ManagedEnvEntry[] = [
    {
      key: "AUTH_SECRET",
      block: "SECURITE",
      comment: "signature des JWT",
      generate: () => "auth-genere",
    },
    { key: "NEXT_PUBLIC_API_URL", block: "API IA", comment: "URL du provider" },
  ];
  return base.map((entry, index) => ({ ...entry, ...overrides[index] }));
}

describe("mergeEnvFile", () => {
  it("cree un fichier complet quand il n'existe pas", () => {
    const { content, created, kept } = mergeEnvFile(null, entries(), HEADER);

    expect(content).toContain("# entete");
    expect(content).toContain("AUTH_SECRET=auth-genere   # signature des JWT");
    expect(content).toContain("NEXT_PUBLIC_API_URL=");
    expect(created).toEqual(["AUTH_SECRET"]);
    expect(kept).toEqual([]);
  });

  it("conserve les variables inconnues et leurs commentaires", () => {
    const existing = [
      "CRON_SECRET=abc",
      "# configuration Google, ajoutee a la main",
      "GOOGLE_CLIENT_ID=xyz   # client google",
      "GOOGLE_CLIENT_SECRET=secret",
      "",
    ].join("\n");

    const { content } = mergeEnvFile(existing, entries(), HEADER);

    expect(content).toContain("CRON_SECRET=abc");
    expect(content).toContain("# configuration Google, ajoutee a la main");
    expect(content).toContain("GOOGLE_CLIENT_ID=xyz   # client google");
    expect(content).toContain("GOOGLE_CLIENT_SECRET=secret");
  });

  it("ne reecrit pas une cle geree deja renseignee", () => {
    const existing = "AUTH_SECRET=valeur-existante   # mon commentaire\n";
    const { content, created, kept } = mergeEnvFile(existing, entries(), HEADER);

    expect(content).toContain("AUTH_SECRET=valeur-existante   # mon commentaire");
    expect(content).not.toContain("auth-genere");
    expect(created).toEqual([]);
    expect(kept).toEqual(["AUTH_SECRET"]);
  });

  it("remplit une cle geree vide en gardant son commentaire", () => {
    const existing = "AUTH_SECRET=   # signature des JWT\n";
    const { content, created } = mergeEnvFile(existing, entries(), HEADER);

    expect(content).toContain("AUTH_SECRET=auth-genere   # signature des JWT");
    expect(created).toEqual(["AUTH_SECRET"]);
  });

  it("ajoute une cle geree absente sans toucher au reste", () => {
    const existing = "CRON_SECRET=abc\n";
    const { content } = mergeEnvFile(existing, entries(), HEADER);

    expect(content.startsWith("CRON_SECRET=abc")).toBe(true);
    expect(content).toContain("AUTH_SECRET=auth-genere");
    expect(content).toContain("NEXT_PUBLIC_API_URL=");
  });

  it("est idempotent : une seconde fusion ne change pas AUTH_SECRET", () => {
    const first = mergeEnvFile(
      "CRON_SECRET=abc\n# commentaire libre\n",
      entries(),
      HEADER
    );
    const second = mergeEnvFile(first.content, entries(), HEADER);

    expect(second.content).toBe(first.content);
    expect(second.created).toEqual([]);
    expect(second.kept).toContain("AUTH_SECRET");
    expect(second.content.match(/AUTH_SECRET=/g)).toHaveLength(1);
  });

  it("ne duplique pas une cle geree presente deux fois", () => {
    const existing = "AUTH_SECRET=premier\nAUTH_SECRET=second\n";
    const { content } = mergeEnvFile(existing, entries(), HEADER);

    expect(content.match(/AUTH_SECRET=/g)).toHaveLength(1);
    expect(content).toContain("AUTH_SECRET=premier");
  });

  it("conserve une cle manuelle vide sans la generer", () => {
    const existing = "NEXT_PUBLIC_API_URL=\n";
    const { content, created } = mergeEnvFile(existing, entries(), HEADER);

    expect(content).toContain("NEXT_PUBLIC_API_URL=");
    expect(created).toEqual(["AUTH_SECRET"]);
    expect(content.match(/NEXT_PUBLIC_API_URL=/g)).toHaveLength(1);
  });
});
