import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = {
  addPhotoShoot: vi.fn(),
  getPhotoShoots: vi.fn(),
  updatePhotoShoot: vi.fn(),
};

vi.mock("@/lib/storage", () => storage);

const { addPhotoShootTool, listPhotoShootsTool, updatePhotoShootTool } = await import(
  "@/modules/photo/tools"
);

const ctx = { moduleId: "photo", log: () => {}, emit: () => {} };

const shoot = {
  id: "s1",
  title: "Concert Muse",
  client: "Muse",
  date: "2026-11-20",
  status: "upcoming",
};

describe("outils photo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storage.addPhotoShoot.mockResolvedValue(shoot);
    storage.getPhotoShoots.mockResolvedValue({ shoots: [shoot] });
  });

  it("ajoute un shooting et confirme par relecture", async () => {
    const result = await addPhotoShootTool.run(
      { title: "Concert Muse", date: "2026-11-20", client: "Muse" },
      ctx
    );
    expect(result.status).toBe("ok");
    expect(result.text).toContain("Concert Muse");
    expect(storage.addPhotoShoot).toHaveBeenCalled();
  });

  it("signale un echec si la relecture ne retrouve pas le shooting", async () => {
    storage.getPhotoShoots.mockResolvedValue({ shoots: [] });
    const result = await addPhotoShootTool.run(
      { title: "Concert Muse", date: "2026-11-20", client: "Muse" },
      ctx
    );
    expect(result.status).toBe("error");
    expect(result.text).toContain("ecriture non confirmee");
  });

  it("met a jour un shooting", async () => {
    storage.updatePhotoShoot.mockResolvedValue({ ...shoot, status: "sent", photosSent: 12 });
    const result = await updatePhotoShootTool.run(
      { id: "s1", status: "sent", photosSent: 12 },
      ctx
    );
    expect(result.status).toBe("ok");
    expect(result.text).toContain("12 photos");
  });

  it("rend un resultat vide si le shooting est introuvable", async () => {
    storage.updatePhotoShoot.mockResolvedValue(null);
    const result = await updatePhotoShootTool.run({ id: "absent" }, ctx);
    expect(result.status).toBe("empty");
  });

  it("liste les shootings", async () => {
    const result = await listPhotoShootsTool.run({}, ctx);
    expect(result.status).toBe("ok");
    expect(result.text).toContain("Concert Muse");
  });

  it("rend un resultat vide sans shooting", async () => {
    storage.getPhotoShoots.mockResolvedValue({ shoots: [] });
    const result = await listPhotoShootsTool.run({}, ctx);
    expect(result.status).toBe("empty");
  });

  it("rejette un statut inconnu", () => {
    expect(
      addPhotoShootTool.params.safeParse({
        title: "x",
        date: "2026-11-20",
        client: "y",
        status: "inconnu",
      }).success
    ).toBe(false);
  });
});
