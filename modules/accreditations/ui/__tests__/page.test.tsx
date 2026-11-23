// @vitest-environment jsdom

import { act, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ModuleActionsProvider,
  ModuleToastProvider,
  type ModuleActionInvoker,
  type ModuleToasts,
} from "@backstage/module-kit";

import type { Accreditation } from "../../schema";
import AccreditationsPage from "../page";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const entry: Accreditation = {
  id: "acc-1",
  artist: "Le Groupe",
  venue: "La Salle",
  concertDate: "2026-12-05",
  status: "pending",
  createdAt: "2026-10-01T10:00:00.000Z",
  updatedAt: "2026-10-01T10:00:00.000Z",
};

function makeToasts(): { toasts: ModuleToasts; show: ReturnType<typeof vi.fn> } {
  const show = vi.fn(() => "toast-1");
  return { toasts: { show, dismiss: vi.fn() }, show };
}

async function mount(element: ReactElement): Promise<{ root: Root; container: HTMLDivElement }> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  return { root, container };
}

function pageFor(call: ModuleActionInvoker, toasts: ModuleToasts) {
  return (
    <ModuleActionsProvider moduleId="accreditations" call={call}>
      <ModuleToastProvider value={toasts}>
        <AccreditationsPage />
      </ModuleToastProvider>
    </ModuleActionsProvider>
  );
}

describe("page des accreditations", () => {
  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("affiche un toast danger quand un changement de statut echoue", async () => {
    const { toasts, show } = makeToasts();
    const call: ModuleActionInvoker = (_moduleId, name) => {
      if (name === "load") return Promise.resolve({ accreditations: [entry] });
      if (name === "updateStatus") return Promise.reject(new Error("Session expiree"));
      return Promise.resolve(null);
    };

    const { root, container } = await mount(pageFor(call, toasts));

    const select = container.querySelector("select");
    expect(select).not.toBeNull();

    await act(async () => {
      select!.value = "accepted";
      select!.dispatchEvent(new Event("change", { bubbles: true }));
    });

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ tone: "danger", message: "Session expiree" })
    );

    await act(async () => {
      root.unmount();
    });
  });

  it("garde le formulaire ouvert quand l'enregistrement echoue", async () => {
    const { toasts, show } = makeToasts();
    const call: ModuleActionInvoker = (_moduleId, name) => {
      if (name === "load") return Promise.resolve({ accreditations: [entry] });
      if (name === "edit") return Promise.reject(new Error("Ecriture refusee"));
      return Promise.resolve(null);
    };

    const { root, container } = await mount(pageFor(call, toasts));

    const edit = container.querySelector('button[aria-label="Modifier Le Groupe"]');
    expect(edit).not.toBeNull();
    await act(async () => {
      (edit as HTMLButtonElement).click();
    });

    const form = container.querySelector("form");
    expect(form).not.toBeNull();
    await act(async () => {
      form!.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(show).toHaveBeenCalledWith(
      expect.objectContaining({ tone: "danger", message: "Ecriture refusee" })
    );
    // L'edition reste ouverte : l'echec ne doit pas ressembler a un succes.
    expect(container.querySelector("form")).not.toBeNull();

    await act(async () => {
      root.unmount();
    });
  });
});
