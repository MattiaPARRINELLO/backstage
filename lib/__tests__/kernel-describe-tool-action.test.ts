import { beforeEach, describe, expect, it, vi } from "vitest";

const registry = { tool: vi.fn() };

vi.mock("@/lib/kernel/registry", () => ({ registry }));

const { describeToolAction } = await import("@/lib/kernel/describe-tool-action");

const registered = {
  name: "emails.reply",
  moduleId: "emails",
  requiresConfirmation: true,
  confirmable: true,
  untrusted: false,
  definition: {
    name: "reply",
    description: "Repond a un email.",
    describeAction: (args: Record<string, unknown>) => `Repondre a l'email ${String(args.email_id)}`,
  },
};

describe("libelle d'une action en attente", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registry.tool.mockImplementation((name: string) =>
      name === "emails.reply" ? registered : undefined
    );
  });

  it("utilise le libelle declare par le module", () => {
    expect(describeToolAction("emails.reply", { email_id: "42" })).toBe(
      "Repondre a l'email 42"
    );
  });

  it("resout un ancien nom d'outil par alias, sans table du noyau", () => {
    expect(describeToolAction("send_email_response", { email_id: "42" })).toBe(
      "Repondre a l'email 42"
    );
    expect(registry.tool).toHaveBeenCalledWith("emails.reply");
  });

  it("retombe sur le nom quand le module ne declare aucun libelle", () => {
    registry.tool.mockReturnValue({
      ...registered,
      definition: { ...registered.definition, describeAction: undefined },
    });
    expect(describeToolAction("emails.reply", {})).toBe("emails.reply");
  });

  it("retombe sur le nom si le libelle leve", () => {
    registry.tool.mockReturnValue({
      ...registered,
      definition: {
        ...registered.definition,
        describeAction: () => {
          throw new Error("boom");
        },
      },
    });
    expect(describeToolAction("emails.reply", {})).toBe("emails.reply");
  });

  it("retombe sur le nom pour un outil inconnu", () => {
    expect(describeToolAction("inconnu", {})).toBe("inconnu");
  });
});
