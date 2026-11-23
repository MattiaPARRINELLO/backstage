import { describe, expect, it } from "vitest";

const { GET } = await import("@/app/api/modules/rail/route");
const { registry } = await import("@/lib/kernel/registry");

describe("GET /api/modules/rail", () => {
  it("sert une entree par module actif qui declare un rail", async () => {
    const response = await GET();
    const body = (await response.json()) as {
      items: { id: string; label: string; href: string; icon: string }[];
    };

    // Derive du registre : installer un module a rail ne casse pas ce test,
    // mais un module desactive ne doit jamais apparaitre (#210).
    const expectedIds = registry.enabled
      .filter((definition) => definition.ui?.rail)
      .map((definition) => definition.id)
      .sort();

    expect(body.items.map((item) => item.id).sort()).toEqual(expectedIds);
    for (const item of body.items) {
      expect(item.href).toBe(`/m/${item.id}`);
      expect(item.label.trim().length).toBeGreaterThan(0);
      expect(item.icon).toContain("<svg");
    }
  });

  it("garde le libelle et l'icone de watch-later", async () => {
    const response = await GET();
    const body = (await response.json()) as {
      items: { id: string; label: string; href: string; icon: string }[];
    };

    expect(body.items.find((item) => item.id === "watch-later")).toMatchObject({
      label: "À voir",
      href: "/m/watch-later",
      icon: expect.stringContaining("<svg"),
    });
  });
});
