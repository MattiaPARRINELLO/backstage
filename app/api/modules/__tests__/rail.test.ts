import { describe, expect, it } from "vitest";

const { GET } = await import("@/app/api/modules/rail/route");

describe("GET /api/modules/rail", () => {
  it("sert le rail des modules actifs, icone incluse", async () => {
    const response = await GET();
    const body = (await response.json()) as {
      items: { id: string; label: string; href: string; icon: string }[];
    };

    expect(body.items).toEqual([
      {
        id: "watch-later",
        label: "À voir",
        href: "/m/watch-later",
        icon: expect.stringContaining("<svg"),
      },
    ]);
  });
});
