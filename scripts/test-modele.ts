import { cpSync, mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const kitSrc = join(root, "packages", "module-kit", "src");
const modele = join(root, "docs", "modules", "modele");
const tmp = mkdtempSync(join(tmpdir(), "backstage-modele-"));

try {
  cpSync(modele, tmp, { recursive: true });
  symlinkSync(join(root, "node_modules"), join(tmp, "node_modules"), "dir");

  const vitestBin = join(root, "node_modules", ".bin", "vitest");
  const result = spawnSync(vitestBin, ["run"], {
    cwd: tmp,
    env: { ...process.env, BACKSTAGE_KIT: kitSrc },
    stdio: "inherit",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
