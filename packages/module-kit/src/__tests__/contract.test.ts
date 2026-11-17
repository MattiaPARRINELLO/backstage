import { describe, expect, it } from "vitest";
import { z } from "zod";

import {
  assertCompatibleApiVersion,
  defineAction,
  defineModule,
  defineTool,
  isConfirmable,
  isUntrusted,
  KERNEL_API,
  ModuleIncompatibleError,
  qualifiedName,
  requiresConfirmation,
  toolError,
  toolOk,
} from "@backstage/module-kit";

function minimalModule(overrides: Record<string, unknown> = {}) {
  return {
    id: "reminders",
    apiVersion: 1,
    version: "1.0.0",
    label: "Rappels",
    selectionDescription: "Gerer des rappels dates.",
    description: "Rappels avec echeance, recurrence et synchronisation Microsoft To Do.",
    ...overrides,
  };
}

const addReminder = defineTool({
  name: "add",
  description: "Cree un rappel.",
  params: z.object({ title: z.string().min(1) }),
  sideEffect: "write",
  run: async (args) => toolOk(`Rappel cree : ${args.title}`),
});

describe("defineTool", () => {
  it("conserve la definition et son schema", () => {
    expect(addReminder.name).toBe("add");
    expect(addReminder.params.safeParse({ title: "x" }).success).toBe(true);
    expect(addReminder.params.safeParse({}).success).toBe(false);
  });

  it("nombre un outil par son module et son nom court", () => {
    expect(qualifiedName("reminders", "add")).toBe("reminders.add");
  });
});

describe("politique derivee de l'effet de bord", () => {
  it("n'exige pas de confirmation pour une lecture", () => {
    expect(requiresConfirmation({ sideEffect: "read" })).toBe(false);
    expect(isConfirmable({ sideEffect: "read" })).toBe(false);
  });

  it("exige une confirmation pour un effet externe", () => {
    expect(requiresConfirmation({ sideEffect: "external" })).toBe(true);
    expect(isConfirmable({ sideEffect: "external" })).toBe(true);
  });

  it("rend une ecriture confirmable, mais pas obligatoirement confirmee", () => {
    expect(requiresConfirmation({ sideEffect: "write" })).toBe(false);
    expect(isConfirmable({ sideEffect: "write" })).toBe(true);
  });

  it("accepte une surcharge explicite du module", () => {
    expect(
      requiresConfirmation({ sideEffect: "write", requiresConfirmation: true })
    ).toBe(true);
    // Retrait explicite : c'est le module qui le decide, pas le noyau.
    expect(
      requiresConfirmation({ sideEffect: "external", requiresConfirmation: false })
    ).toBe(false);
  });

  it("considere un resultat fiable par defaut", () => {
    expect(isUntrusted({ sideEffect: "read" })).toBe(false);
    expect(isUntrusted({ sideEffect: "read", trust: "trusted" })).toBe(false);
    expect(isUntrusted({ sideEffect: "read", trust: "untrusted" })).toBe(true);
  });
});

describe("resultats d'outil", () => {
  const ctx = {
    moduleId: "reminders",
    log: () => {},
    emit: () => {},
  };

  it("porte le statut dans la donnee, pas dans la formulation", async () => {
    const ok = await addReminder.run({ title: "Appeler" }, ctx);
    expect(ok).toEqual({ status: "ok", text: "Rappel cree : Appeler" });
    expect(toolError("Erreur : introuvable")).toEqual({
      status: "error",
      text: "Erreur : introuvable",
    });
  });
});

describe("defineModule", () => {
  it("accepte un module conforme", () => {
    const definition = defineModule({ ...minimalModule(), tools: [addReminder] });
    expect(definition.id).toBe("reminders");
  });

  it("refuse un identifiant hors kebab-case", () => {
    expect(() => defineModule(minimalModule({ id: "Rappels" }))).toThrow(/invalide/);
    expect(() => defineModule(minimalModule({ id: "sous_dossier" }))).toThrow(/invalide/);
  });

  it("refuse une version qui n'est pas du semver", () => {
    expect(() => defineModule(minimalModule({ version: "v1" }))).toThrow(/semver/);
  });

  it("refuse un nom d'outil invalide", () => {
    expect(() =>
      defineModule(
        minimalModule({
          tools: [{ ...addReminder, name: "addReminder" }],
        })
      )
    ).toThrow(/snake_case/);
  });

  it("refuse deux outils du meme nom", () => {
    expect(() =>
      defineModule(minimalModule({ tools: [addReminder, addReminder] }))
    ).toThrow(/deux fois/);
  });

  it("refuse une dependance sur soi-meme", () => {
    expect(() =>
      defineModule(minimalModule({ dependencies: ["reminders"] }))
    ).toThrow(/lui-meme/);
  });
});

describe("compatibilite d'apiVersion", () => {
  it("accepte la version du noyau et les precedentes", () => {
    expect(() => assertCompatibleApiVersion("reminders", KERNEL_API)).not.toThrow();
    expect(() => assertCompatibleApiVersion("reminders", 1, 3)).not.toThrow();
  });

  it("refuse une version superieure avec un message actionnable", () => {
    expect(() => assertCompatibleApiVersion("reminders", 2, 1)).toThrow(
      ModuleIncompatibleError
    );
    try {
      assertCompatibleApiVersion("reminders", 2, 1);
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain("reminders");
      expect(message).toContain("2");
      expect(message).toContain("1");
      expect(message).toContain("Mets a jour le noyau");
    }
  });

  it("refuse une apiVersion absente ou invalide", () => {
    expect(() => assertCompatibleApiVersion("reminders", 0)).toThrow(/entier positif/);
    expect(() => assertCompatibleApiVersion("reminders", 1.5)).toThrow(/entier positif/);
  });
});

describe("defineAction", () => {
  it("type l'entree par son schema Zod", () => {
    const action = defineAction({
      name: "create",
      input: z.object({ title: z.string() }),
      run: async (input) => input.title.toUpperCase(),
    });
    expect(action.name).toBe("create");
    expect(action.input.safeParse({ title: "x" }).success).toBe(true);
  });
});
