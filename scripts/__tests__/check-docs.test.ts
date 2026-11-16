import { describe, expect, it } from "vitest";
import {
  checkDocs,
  extractReferences,
  looksLikeFilePath,
  suggestFile,
} from "@/scripts/check-docs";

const files = [
  "README.md",
  "docs/README.md",
  "docs/design.md",
  "docs/architecture.md",
  "lib/config.ts",
  "lib/storage/reminders.ts",
  "components/chat/ChatView.tsx",
  "public/backstage-logo.png",
];

function run(docs: { path: string; content: string }[]) {
  return checkDocs(docs, files);
}

describe("extractReferences", () => {
  it("extrait les backticks et les liens Markdown relatifs", () => {
    const references = extractReferences(
      ["Voir `lib/config.ts` et [design](../design.md).", "![logo](/backstage-logo.png)"].join("\n")
    );

    expect(references).toEqual([
      { line: 1, reference: "lib/config.ts", fromSourceDir: false },
      { line: 1, reference: "../design.md", fromSourceDir: true },
      { line: 2, reference: "/backstage-logo.png", fromSourceDir: true },
    ]);
  });

  it("retire le suffixe de ligne d'une reference fichier:ligne", () => {
    const [reference] = extractReferences("`lib/config.ts:42-58`");
    expect(reference.reference).toBe("lib/config.ts");
  });

  it("retire aussi le suffixe de ligne d'un lien Markdown", () => {
    const [reference] = extractReferences("[vue](../lib/config.ts:42)");
    expect(reference.reference).toBe("../lib/config.ts");
  });

  it("ignore les liens externes et les ancres", () => {
    expect(
      extractReferences("[site](https://example.com) [ici](#section) [mail](mailto:a@b.c)")
    ).toEqual([]);
  });
});

describe("looksLikeFilePath", () => {
  it("reconnait un chemin", () => {
    expect(looksLikeFilePath("lib/config.ts")).toBe(true);
    expect(looksLikeFilePath("docs//design.md")).toBe(true);
  });

  it("rejette une commande, un selecteur CSS et une propriete", () => {
    expect(looksLikeFilePath("bunx vitest run lib/config.ts")).toBe(false);
    expect(looksLikeFilePath(".ui-card")).toBe(false);
    expect(looksLikeFilePath("process.env")).toBe(false);
  });
});

describe("checkDocs, cas vert", () => {
  it("accepte les chemins, les noms seuls et les liens relatifs", () => {
    const result = run([
      {
        path: "docs/README.md",
        content: [
          "`lib/config.ts`",
          "`ChatView.tsx`",
          "`/backstage-logo.png`",
          "[design](./design.md)",
          "[archi](architecture.md#contrat)",
        ].join("\n"),
      },
    ]);

    expect(result.errors).toEqual([]);
    expect(result.checked).toBe(5);
  });
});

describe("checkDocs, reference morte", () => {
  it("signale le fichier, la ligne, la reference et une suggestion", () => {
    const result = run([
      { path: "docs/README.md", content: ["Titre", "Voir `lib/configs.ts`."].join("\n") },
    ]);

    expect(result.errors).toEqual([
      { source: "docs/README.md", line: 2, reference: "lib/configs.ts", suggestion: "lib/config.ts" },
    ]);
  });

  it("signale un lien Markdown relatif casse", () => {
    const result = run([{ path: "docs/README.md", content: "[design](../designs.md)" }]);

    expect(result.errors[0]).toMatchObject({
      source: "docs/README.md",
      line: 1,
      reference: "../designs.md",
      suggestion: "docs/design.md",
    });
  });
});

describe("checkDocs, exceptions", () => {
  it("ignore les placeholders declares", () => {
    const result = run([
      {
        path: "docs/README.md",
        content: [
          "`PascalCase.tsx`",
          "`kebab-case.ts`",
          "`MonComposant.tsx`",
          "`components/<categorie>/MonComposant.tsx`",
          "`.../MainActivity.java`",
        ].join("\n"),
      },
    ]);

    expect(result.errors).toEqual([]);
    expect(result.skipped.every((skip) => skip.reason === "placeholder")).toBe(true);
    expect(result.checked).toBe(0);
  });

  it("ignore le prefixe data/ et les fichiers de donnees cites seuls", () => {
    const result = run([
      {
        path: "docs/README.md",
        content: ["`data/reminders.json`", "`users.json`", "`chat-history.json`"].join("\n"),
      },
    ]);

    expect(result.errors).toEqual([]);
    expect(result.skipped.map((skip) => skip.reason)).toEqual(["data", "data", "data"]);
  });

  it("ignore les fichiers gitignores", () => {
    const result = checkDocs([{ path: "docs/README.md", content: "`e2e/.auth/state.json`" }], files, (candidate) =>
      candidate.startsWith("e2e/.auth/")
    );

    expect(result.errors).toEqual([]);
    expect(result.skipped).toEqual([
      { source: "docs/README.md", line: 1, reference: "e2e/.auth/state.json", reason: "ignored" },
    ]);
  });

  it("ignore un document de roadmap qui decrit des fichiers a venir", () => {
    const result = run([
      { path: "docs/roadmap-multi-utilisateurs.md", content: "`lib/modules.ts`" },
    ]);

    expect(result.errors).toEqual([]);
    expect(result.skipped[0].reason).toBe("future-doc");
  });
});

describe("suggestFile", () => {
  it("prefere un fichier de meme nom", () => {
    expect(suggestFile("state.json", ["e2e/state.json", "app/state.json"])).toBe("e2e/state.json");
  });

  it("se tait quand aucune suggestion n'est proche", () => {
    expect(suggestFile("zzzzzzzzz.ts", files)).toBeUndefined();
  });
});
