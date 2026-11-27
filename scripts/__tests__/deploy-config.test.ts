import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// Regression : le rsync incluait `data/config.json` depuis le poste local et
// ecrasait les modeles choisis en production a chaque deploiement.
describe("deploy.sh — configuration serveur", () => {
  const script = readFileSync(path.join(process.cwd(), "deploy.sh"), "utf8");

  it("ne transfere jamais data/config.json depuis le poste local", () => {
    expect(script).not.toContain("--include 'data/config.json'");
  });

  it("protege les JSON du serveur et ne synchronise que le compte de service", () => {
    expect(script).toContain("--include 'data/firebase-service-account.json'");
    expect(script).toContain("--exclude 'data/*.json'");
  });
});
