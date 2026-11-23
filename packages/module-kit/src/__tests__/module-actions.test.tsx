// @vitest-environment jsdom

import { act, useEffect, useMemo, useState, type ReactElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  ModuleActionsProvider,
  useModuleAction,
  type ModuleActionCall,
  type ModuleActionInvoker,
} from "../module-actions";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Une Server Action transmise par un composant serveur a un composant client
 * n'a pas d'identite stable entre deux rendus RSC. Ces tests reproduisent ce
 * comportement : `call` est recree a chaque rendu du provider, comme le fait
 * `app/m/[module]/page.tsx`.
 */

let forceRender: () => void = () => {};
let loads = 0;
let seenCalls: ModuleActionCall[] = [];
let latestInvoker: ModuleActionCall | null = null;
let invoked: string[] = [];

function Consumer() {
  const call = useModuleAction();
  const api = useMemo(() => ({ load: () => call("load", {}) }), [call]);

  useEffect(() => {
    loads += 1;
    seenCalls.push(call);
    latestInvoker = call;
  }, [api, call]);

  return null;
}

async function mount(element: ReactElement): Promise<Root> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(element);
  });
  return root;
}

describe("useModuleAction", () => {
  beforeEach(() => {
    loads = 0;
    seenCalls = [];
    latestInvoker = null;
    invoked = [];
  });

  afterEach(() => {
    forceRender = () => {};
    document.body.innerHTML = "";
  });

  it("garde une identite stable quand la propriete call change a chaque rendu", async () => {
    function Harness() {
      const [, setTick] = useState(0);
      useEffect(() => {
        forceRender = () => setTick((tick) => tick + 1);
      }, []);

      // Nouvelle identite a chaque rendu, comme le payload RSC.
      const call: ModuleActionInvoker = () => Promise.resolve(null);

      return (
        <ModuleActionsProvider moduleId="module-de-test" call={call}>
          <Consumer />
        </ModuleActionsProvider>
      );
    }

    const root = await mount(<Harness />);

    expect(loads).toBe(1);

    for (let index = 0; index < 3; index += 1) {
      await act(async () => {
        forceRender();
      });
    }

    // Un seul chargement : l'effet memoise sur `api` n'a pas ete relance.
    expect(loads).toBe(1);
    // Et l'identite rendue n'a pas change non plus.
    expect(new Set(seenCalls).size).toBe(1);

    await act(async () => {
      root.unmount();
    });
  });

  it("appelle toujours la derniere invocation fournie, pas la premiere", async () => {
    function Harness() {
      const [tick, setTick] = useState(0);
      useEffect(() => {
        forceRender = () => setTick((value) => value + 1);
      }, []);

      const call: ModuleActionInvoker = (_moduleId, name) => {
        invoked.push(`${tick}:${name}`);
        return Promise.resolve(null);
      };

      return (
        <ModuleActionsProvider moduleId="module-de-test" call={call}>
          <Consumer />
        </ModuleActionsProvider>
      );
    }

    const root = await mount(<Harness />);

    await act(async () => {
      forceRender();
    });

    await act(async () => {
      await latestInvoker?.("action", {});
    });

    expect(invoked).toEqual(["1:action"]);

    await act(async () => {
      root.unmount();
    });
  });
});
