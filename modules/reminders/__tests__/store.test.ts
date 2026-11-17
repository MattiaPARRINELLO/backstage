import { describe, expect, it } from "vitest";

import { remindersStore } from "@/modules/reminders/store";
import { remindersDataSchema } from "@/modules/reminders/schema";

describe("store des rappels", () => {
  it("lit et ecrit le fichier historique, sans deplacement", () => {
    expect(remindersStore.path).toBe("reminders.json");
  });
});

describe("schema des rappels", () => {
  it("accepte une entree telle que l'application l'ecrit aujourd'hui", () => {
    const existing = {
      reminders: [
        {
          id: "r1",
          title: "Appeler la salle",
          dueAt: "2026-11-20T10:00:00.000Z",
          status: "pending",
          createdAt: "2026-11-17T10:00:00.000Z",
          updatedAt: "2026-11-17T10:00:00.000Z",
          notifiedAt: null,
          recurrence: "weekly",
          microsoftTaskId: "AAMk",
          microsoftListId: "lista",
        },
      ],
    };
    expect(remindersDataSchema.safeParse(existing).success).toBe(true);
  });

  it("conserve les champs inconnus au lieu de les supprimer", () => {
    const parsed = remindersDataSchema.parse({
      reminders: [],
      champFutur: "garde-moi",
    });
    expect(parsed).toHaveProperty("champFutur", "garde-moi");
  });

  it("refuse un rappel sans identifiant", () => {
    expect(
      remindersDataSchema.safeParse({
        reminders: [{ title: "x", dueAt: "2026-01-01", status: "pending", createdAt: "" }],
      }).success
    ).toBe(false);
  });
});
