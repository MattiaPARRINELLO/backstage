import { describe, expect, it, vi } from "vitest";
import { railIcon } from "@backstage/module-kit";

import { renderRailIcon } from "@/lib/kernel/rail-markup";

describe("rendu d'une icone de rail", () => {
  it("sert le SVG declaratif du module", () => {
    const markup = renderRailIcon(railIcon('<path d="M1 1h22v22H1z" />'));
    expect(markup).toContain("<svg");
    expect(markup).toContain('class="h-full w-full"');
    expect(markup).toContain("M1 1h22v22H1z");
  });

  it("utilise un glyphe neutre pour un composant non declaratif", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const ClientIcon = () => null;

    const markup = renderRailIcon(ClientIcon);

    expect(markup).toContain("<rect");
    expect(warn).toHaveBeenCalledWith(
      "[module-rail] icone non declarative, glyphe neutre utilise. Utiliser railIcon() du kit."
    );
    warn.mockRestore();
  });
});
