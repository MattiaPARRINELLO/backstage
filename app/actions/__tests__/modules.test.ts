import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { serializeConfig, writeLock } from "@/lib/kernel/module-files";

/**
 * Actions de gestion des modules (issue #270).
 *
 * Tout se passe sur un depot temporaire : aucun clone, aucun reseau. Le
 * registre est remplace par un registre de modules factices pour que
 * `served`/`active` soient controlables, et `installModule` est mocke : son
 * comportement (snapshot, rollback, clone) est deja couvert par
 * `lib/__tests__/module-install.test.ts`.
 */

const mocks = vi.hoisted(() => ({
  root: { current: "" },
  logActivity: vi.fn(),
  revalidatePath: vi.fn(),
  installModule: vi.fn(),
  readCatalog: vi.fn(),
}));

vi.mock("@/lib/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ userId: "test-user" }),
}));

vi.mock("@/lib/storage", () => ({ logActivity: mocks.logActivity }));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

vi.mock("@/lib/kernel/module-install", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/kernel/module-install")>();
  return { ...actual, installModule: mocks.installModule };
});

vi.mock("@/lib/kernel/module-catalog", () => ({ readCatalog: mocks.readCatalog }));

vi.mock("@/lib/kernel/module-admin", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/kernel/module-admin")>();
  return { ...actual, modulesRoot: () => mocks.root.current };
});

vi.mock("@/lib/kernel/registry", async () => {
  const { defineModule } = await import("@backstage/module-kit");
  const { createRegistry } = await import("@/lib/kernel/registry-core");
  const definitions = ["alpha", "beta", "ghost", "gamma"].map((id) =>
    defineModule({
      id,
      apiVersion: 1,
      version: "1.0.0",
      label: id,
      selectionDescription: `Gerer ${id}.`,
      description: `Module ${id}.`,
    })
  );
  const active = ["alpha", "ghost"];
  return {
    registry: createRegistry(definitions, { enabled: active }),
    getRegistry: () => createRegistry(definitions, { enabled: active }),
    invalidateRegistry: () => {},
    enabledConfigError: (enabled: readonly string[]) => {
      try {
        createRegistry(definitions, { enabled });
        return null;
      } catch (error) {
        return error instanceof Error ? error.message : String(error);
      }
    },
  };
});

const { installModuleFromSource, listInstalledModules, listModuleCatalog, removeModuleById, setModuleEnabled } =
  await import("@/app/actions/modules");

const COMPOSITION = [
  'import alpha from "./alpha/module";',
  'import ghost from "./ghost/module";',
  "",
  "export const modules: readonly ModuleDefinition[] = [alpha, ghost];",
  "",
].join("\n");

const roots: string[] = [];

function temporaryRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "modules-ui-"));
  roots.push(root);
  mkdirSync(join(root, "modules"), { recursive: true });
  writeFileSync(join(root, "modules", "index.ts"), COMPOSITION, "utf8");
  writeFileSync(
    join(root, "modules.config.json"),
    serializeConfig({
      kernelApi: 1,
      modules: { alpha: { enabled: true }, ghost: { enabled: true } },
    }),
    "utf8"
  );
  writeLock(root, { modules: {} });
  return root;
}

function configOf(root: string): { modules: Record<string, { enabled?: boolean }> } {
  return JSON.parse(readFileSync(join(root, "modules.config.json"), "utf8"));
}

beforeEach(() => {
  mocks.root.current = temporaryRoot();
  mocks.logActivity.mockReset().mockResolvedValue(undefined);
  mocks.revalidatePath.mockReset();
  mocks.installModule.mockReset();
  mocks.readCatalog.mockReset();
});

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("listInstalledModules", () => {
  it("rend l'etat du registre, pas seulement la config", async () => {
    const state = await listInstalledModules();

    const alpha = state.modules.find((row) => row.id === "alpha");
    expect(alpha).toMatchObject({
      status: "active",
      served: true,
      active: true,
      configured: true,
      bundled: true,
      commit: null,
    });

    // Present dans le registre factice mais absent de la composition : integre.
    const beta = state.modules.find((row) => row.id === "beta");
    expect(beta).toMatchObject({ status: "inactive", served: true, active: false });

    expect(state.rebuildRequired).toBe(false);
    expect(state.configSource).toBe("file");
  });

  it("signale un rebuild quand la config active un module absent du build", async () => {
    mocks.root.current = temporaryRoot();
    writeFileSync(
      join(mocks.root.current, "modules.config.json"),
      serializeConfig({
        kernelApi: 1,
        modules: { alpha: { enabled: true }, delta: { enabled: true } },
      }),
      "utf8"
    );

    const state = await listInstalledModules();
    const delta = state.modules.find((row) => row.id === "delta");
    expect(delta?.status).toBe("rebuild");
    expect(state.rebuildRequired).toBe(true);
  });
});

describe("setModuleEnabled", () => {
  it("bascule un module sain et journalise l'action", async () => {
    const result = await setModuleEnabled({ id: "alpha", enabled: false });

    expect(result).toEqual({ id: "alpha", enabled: false });
    expect(configOf(mocks.root.current).modules.alpha).toEqual({ enabled: false });
    expect(mocks.logActivity).toHaveBeenCalledWith("module_disabled", "Module desactive : alpha");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/settings/modules");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/m/alpha");
  });

  it("refuse un module en erreur chez le doctor", async () => {
    writeLock(mocks.root.current, {
      modules: {
        ghost: {
          repo: "https://example.test/ghost.git",
          ref: "v1.0.0",
          commit: "deadbeef",
          installedAt: new Date().toISOString(),
        },
      },
    });

    await expect(setModuleEnabled({ id: "ghost", enabled: false })).rejects.toMatchObject({
      code: "validation",
      message: expect.stringContaining("probleme du doctor"),
    });
    expect(configOf(mocks.root.current).modules.ghost.enabled).toBe(true);
  });

  it("refuse un module absent du build en cours", async () => {
    writeFileSync(
      join(mocks.root.current, "modules.config.json"),
      serializeConfig({
        kernelApi: 1,
        modules: { alpha: { enabled: true }, delta: { enabled: true } },
      }),
      "utf8"
    );

    await expect(setModuleEnabled({ id: "delta", enabled: true })).rejects.toMatchObject({
      code: "validation",
      message: expect.stringContaining("rebuild requis"),
    });
  });

  it("refuse un payload non strict", async () => {
    await expect(
      setModuleEnabled({ id: "alpha", enabled: false, extra: 1 } as never)
    ).rejects.toMatchObject({ code: "validation" });
  });
});

describe("installModuleFromSource", () => {
  it("refuse une ref mobile sans cloner", async () => {
    await expect(
      installModuleFromSource({ source: "https://example.test/module.git#main" })
    ).rejects.toMatchObject({
      code: "validation",
      message: expect.stringContaining("jamais une branche mobile"),
    });
    expect(mocks.installModule).not.toHaveBeenCalled();
  });

  it("refuse une source sans ref", async () => {
    await expect(
      installModuleFromSource({ source: "https://example.test/module.git" })
    ).rejects.toMatchObject({ code: "validation" });
    expect(mocks.installModule).not.toHaveBeenCalled();
  });

  it("remonte le conflit d'identifiant du noyau", async () => {
    mocks.installModule.mockRejectedValue(
      new Error('Conflit d\'identifiant : "delta" est deja installe.')
    );

    await expect(
      installModuleFromSource({ source: "https://example.test/module.git#v1.0.0" })
    ).rejects.toMatchObject({ code: "validation" });
  });

  it("installe, journalise et annonce un rebuild", async () => {
    mocks.installModule.mockResolvedValue({
      id: "delta",
      label: "Delta",
      apiVersion: 1,
      commit: "abc1234def",
      repo: "https://example.test/module.git",
      ref: "v1.0.0",
      capabilities: { network: true, env: ["DELTA_KEY"] },
    });

    const result = await installModuleFromSource({
      source: "https://example.test/module.git#v1.0.0",
    });

    expect(result).toEqual({
      id: "delta",
      commit: "abc1234def",
      capabilities: { network: true, env: ["DELTA_KEY"] },
      rebuildRequired: true,
    });
    expect(mocks.logActivity).toHaveBeenCalledWith(
      "module_installed",
      "Module installe : delta",
      expect.stringContaining("abc1234def")
    );
  });
});

describe("removeModuleById", () => {
  it("refuse de retirer un module integre", async () => {
    await expect(removeModuleById({ id: "alpha" })).rejects.toMatchObject({
      code: "validation",
      message: expect.stringContaining("integre"),
    });
  });

  it("retire un module externe et annonce un rebuild", async () => {
    writeLock(mocks.root.current, {
      modules: {
        gamma: {
          repo: "https://example.test/gamma.git",
          ref: "v2.0.0",
          commit: "cafebabe",
          installedAt: new Date().toISOString(),
        },
      },
    });

    const result = await removeModuleById({ id: "gamma" });

    expect(result).toEqual({ id: "gamma", rebuildRequired: true });
    expect(mocks.logActivity).toHaveBeenCalledWith("module_removed", "Module retire : gamma");
  });
});

describe("listModuleCatalog", () => {
  it("rend une erreur explicite quand le catalogue est injoignable", async () => {
    mocks.readCatalog.mockResolvedValue({
      ok: false,
      error: "Catalogue des modules injoignable : HTTP 503",
      entries: [],
      fetchedAt: null,
      fromCache: false,
    });

    await expect(listModuleCatalog()).rejects.toMatchObject({ code: "external_unavailable" });
  });
});
