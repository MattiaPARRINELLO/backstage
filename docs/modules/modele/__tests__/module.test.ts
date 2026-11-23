import { describe, expect, it } from "vitest";

import {
  assertToolError,
  assertToolOk,
  createTestContext,
  expectValidModule,
  runTool,
  withTempDataDir,
} from "@backstage/module-kit/testing";

import module from "../module";
import { notesStore } from "../store";
import { addNoteTool } from "../tools";

describe("manifeste", () => {
  it("respecte le contrat du kit", () => {
    expect(() => expectValidModule(module)).not.toThrow();
  });
});

describe("outil add", () => {
  it("ecrit une note, la relit et la journalise", async () => {
    await withTempDataDir(async () => {
      const ctx = createTestContext({ moduleId: "demo-notes" });

      const result = await runTool(addNoteTool, { text: "Premiere note" }, ctx);
      assertToolOk(result);

      const { notes } = await notesStore.read();
      expect(notes).toHaveLength(1);
      expect(notes[0]?.text).toBe("Premiere note");
      expect(ctx.activityEntries).toEqual([
        { type: "note_created", message: "Note ajoutee : Premiere note" },
      ]);
    });
  });

  it("refuse un texte vide avant d'ecrire", async () => {
    await withTempDataDir(async () => {
      const ctx = createTestContext({ moduleId: "demo-notes" });

      assertToolError(await runTool(addNoteTool, { text: "   " }, ctx), /Erreur :/);

      const { notes } = await notesStore.read();
      expect(notes).toEqual([]);
    });
  });
});
