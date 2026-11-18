import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const SOURCE = path.join(process.cwd(), "lib", "chat-tools.ts");

describe("budget de lib/chat-tools.ts (#84)", () => {
  const source = fs.readFileSync(SOURCE, "utf8");
  const lines = source.split("\n");

  it("reste le pont vers le registre, sous 120 lignes", () => {
    expect(lines.length).toBeLessThan(120);
  });

  it("ne contient plus de dispatch par capacite", () => {
    expect(source).not.toMatch(/^\s*case\s+"/m);
  });
});
