// @vitest-environment jsdom

import { act, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";

const { updateModels } = vi.hoisted(() => ({ updateModels: vi.fn() }));

vi.mock("@/app/actions/settings", () => ({ updateModels }));

import { SettingsModels } from "../SettingsModels";
import type { ModelSelection, RuntimeInfo } from "../useRuntimeInfo";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

const available = [
  "deepseek-v4.1-flash",
  "glm-5.3",
  "qwen3.8-max",
  "qwen4-max",
];

const valid: ModelSelection = {
  general: "deepseek-v4.1-flash",
  generalAlt: "qwen3.8-max",
  code: "qwen4-max",
};

function runtimeFor(models: ModelSelection): RuntimeInfo {
  return {
    models,
    availableModels: available,
    features: { dailyBrief: true, webSearch: true },
    pushCount: 1,
  };
}

function Harness({ initial }: { initial: ModelSelection }) {
  const [models, setModels] = useState<ModelSelection | null>(initial);
  return (
    <SettingsModels
      runtime={runtimeFor(initial)}
      modelSel={models}
      setModelSel={setModels}
    />
  );
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function mount(element: ReactElement): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(element);
  });
}

function button(label: string): HTMLButtonElement {
  const found = Array.from(container?.querySelectorAll("button") ?? []).find(
    (candidate) => candidate.textContent?.trim() === label
  );
  if (!found) throw new Error(`bouton "${label}" introuvable`);
  return found as HTMLButtonElement;
}

function select(label: string): HTMLSelectElement {
  const found = container?.querySelector(`select[aria-label="${label}"]`);
  if (!found) throw new Error(`select "${label}" introuvable`);
  return found as HTMLSelectElement;
}

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
  vi.clearAllMocks();
});

describe("SettingsModels — modele disparu du provider", () => {
  const stale: ModelSelection = {
    general: "modele-mort",
    generalAlt: "qwen3.8-max",
    code: "qwen4-max",
  };

  it("signale le modele indisponible et bloque la sauvegarde", async () => {
    await mount(<Harness initial={stale} />);

    expect(container?.textContent).toContain("Modèle(s) indisponible(s) : principal");
    expect(button("Sauvegarder").disabled).toBe(true);

    await act(async () => {
      button("Sauvegarder").click();
    });
    expect(updateModels).not.toHaveBeenCalled();
  });

  it("remplace le modele mort par un modele disponible en un clic", async () => {
    await mount(<Harness initial={stale} />);

    await act(async () => {
      button("Choisir un modèle disponible").click();
    });

    expect(select("Modèle principal").value).toBe("deepseek-v4.1-flash");
    expect(button("Sauvegarder").disabled).toBe(false);
    expect(container?.textContent).not.toContain("Modèle(s) indisponible(s)");
  });

  it("sauvegarde une selection valide", async () => {
    updateModels.mockResolvedValue(valid);
    await mount(<Harness initial={valid} />);

    await act(async () => {
      button("Sauvegarder").click();
    });

    expect(updateModels).toHaveBeenCalledWith(valid);
    expect(container?.textContent).toContain("Modèles mis à jour");
  });

  it("traduit l'erreur redigee de Next en message lisible", async () => {
    updateModels.mockRejectedValue(
      new Error(
        "An error occurred in the Server Components render. The specific message is omitted in production builds."
      )
    );
    await mount(<Harness initial={valid} />);

    await act(async () => {
      button("Sauvegarder").click();
    });

    expect(container?.textContent).toContain(
      "Le provider a refusé ce modèle. Recharge la page pour rafraîchir la liste."
    );
  });
});
