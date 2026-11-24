// @vitest-environment jsdom

import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ModuleToastProvider, type ModuleToasts } from "@backstage/module-kit";

import type { Accreditation } from "../../schema";
import { AccreditationRow } from "../AccreditationRow";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const entry: Accreditation = {
  id: "acc-1",
  artist: "Le Groupe",
  venue: "La Salle",
  concertDate: "2026-12-05",
  status: "sent",
  needsReview: false,
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
  followUpDraft: "Bonjour, je me permets de revenir vers vous.",
};

async function mount(element: React.ReactElement): Promise<{ root: Root; container: HTMLDivElement }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  return { root, container };
}

describe("AccreditationRow", () => {
  afterEach(() => {
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });

  it("affiche le badge d'une fiche a verifier", async () => {
    const toasts: ModuleToasts = { show: vi.fn(() => "toast-1"), dismiss: vi.fn() };
    const { root, container } = await mount(
      <ModuleToastProvider value={toasts}>
        <AccreditationRow
          accreditation={{ ...entry, needsReview: true }}
          onStatus={vi.fn(async () => undefined)}
          onSave={vi.fn(async () => true)}
          onDelete={vi.fn(async () => undefined)}
        />
      </ModuleToastProvider>
    );

    expect(container.textContent).toContain("À vérifier");

    await act(async () => {
      root.unmount();
    });
  });

  it("explique un presse-papiers indisponible et laisse le texte visible", async () => {
    const show = vi.fn(() => "toast-1");
    const toasts: ModuleToasts = { show, dismiss: vi.fn() };
    const onStatus = vi.fn(async () => undefined);
    const onSave = vi.fn(async () => true);
    const onDelete = vi.fn(async () => undefined);

    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText: vi.fn().mockRejectedValue(new Error("NotAllowedError")) },
    });

    const { root, container } = await mount(
      <ModuleToastProvider value={toasts}>
        <AccreditationRow
          accreditation={entry}
          onStatus={onStatus}
          onSave={onSave}
          onDelete={onDelete}
        />
      </ModuleToastProvider>
    );

    const copy = Array.from(container.querySelectorAll("button")).find(
      (button) => button.textContent === "Copier le texte"
    );
    expect(copy).toBeDefined();

    await act(async () => {
      (copy as HTMLButtonElement).click();
    });

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ tone: "danger", message: "Copier impossible" })
    );
    // Le brouillon reste selectionnable a la main.
    expect(container.textContent).toContain(entry.followUpDraft);

    await act(async () => {
      root.unmount();
    });
  });
});
