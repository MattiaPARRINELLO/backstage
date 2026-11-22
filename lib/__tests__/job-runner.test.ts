import { afterEach, describe, expect, it, vi } from "vitest";

import { defineModule, type ModuleContext } from "@backstage/module-kit";

import { createJobRunner } from "@/lib/kernel/job-runner";
import { createRegistry } from "@/lib/kernel/registry-core";

const at = (hour: number, minute: number): Date =>
  new Date(2026, 10, 22, hour, minute, 0, 0);

const context = (moduleId: string): ModuleContext => ({
  moduleId,
  log: () => {},
  emit: () => {},
});

function registryWith(alpha: () => Promise<void>, beta: () => Promise<void>) {
  return createRegistry([
    defineModule({
      id: "alpha",
      apiVersion: 1,
      version: "1.0.0",
      label: "Alpha",
      selectionDescription: "Alpha",
      description: "Alpha",
      jobs: [{ id: "alpha-job", cron: "* * * * *", handler: alpha }],
    }),
    defineModule({
      id: "beta",
      apiVersion: 1,
      version: "1.0.0",
      label: "Beta",
      selectionDescription: "Beta",
      description: "Beta",
      jobs: [{ id: "beta-job", cron: "0 7 * * *", handler: beta }],
    }),
  ]);
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("runner de jobs — selection par le registre", () => {
  it("execute les jobs dus, sans connaitre leurs noms", async () => {
    const alpha = vi.fn(async () => {});
    const beta = vi.fn(async () => {});
    const registry = registryWith(alpha, beta);
    const runner = createJobRunner({ jobs: registry.jobs, context });

    await runner.tick(at(7, 0));
    expect(alpha).toHaveBeenCalledTimes(1);
    expect(beta).toHaveBeenCalledTimes(1);

    await runner.tick(at(7, 1));
    expect(alpha).toHaveBeenCalledTimes(2);
    expect(beta).toHaveBeenCalledTimes(1);
  });

  it("passe le contexte du module proprietaire", async () => {
    const contexts: string[] = [];
    const registry = registryWith(
      async () => {},
      async () => {}
    );
    const runner = createJobRunner({
      jobs: registry.jobs,
      context: (moduleId) => {
        contexts.push(moduleId);
        return context(moduleId);
      },
    });

    await runner.tick(at(7, 0));
    expect(contexts.sort()).toEqual(["alpha", "beta"]);
  });

  it("journalise un job en echec sans arreter les autres", async () => {
    const alpha = vi.fn(async () => {
      throw new Error("boum");
    });
    const beta = vi.fn(async () => {});
    const log = vi.fn();
    const registry = registryWith(alpha, beta);
    const runner = createJobRunner({ jobs: registry.jobs, context, log });

    await expect(runner.tick(at(7, 0))).resolves.toBeUndefined();
    expect(alpha).toHaveBeenCalledTimes(1);
    expect(beta).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("error", expect.stringContaining("alpha-job"), expect.any(Error));
  });

  it("ne chevauche pas un meme job", async () => {
    let release: () => void = () => {};
    const pending = new Promise<void>((resolve) => {
      release = resolve;
    });
    const alpha = vi.fn(() => pending);
    const log = vi.fn();
    const registry = registryWith(alpha, async () => {});
    const runner = createJobRunner({ jobs: registry.jobs, context, log });

    const first = runner.tick(at(7, 0));
    expect(runner.isRunning("alpha-job")).toBe(true);

    await runner.tick(at(7, 0));
    expect(alpha).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith("warn", expect.stringContaining("deja en cours"));

    release();
    await first;
    expect(runner.isRunning("alpha-job")).toBe(false);
  });

  it("demarre immediatement et s'arrete proprement", async () => {
    vi.useFakeTimers();
    const alpha = vi.fn(async () => {});
    const beta = vi.fn(async () => {});
    const registry = registryWith(alpha, beta);
    const runner = createJobRunner({
      jobs: registry.jobs,
      context,
      now: () => at(7, 0),
      intervalMs: 60_000,
    });

    runner.start();
    await vi.advanceTimersByTimeAsync(0);
    expect(alpha).toHaveBeenCalledTimes(1);
    expect(beta).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(60_000);
    expect(alpha).toHaveBeenCalledTimes(2);

    runner.stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(alpha).toHaveBeenCalledTimes(2);
  });
});
