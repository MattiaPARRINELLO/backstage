"use client";

import { useEffect, useState } from "react";

export type RuntimeInfo = {
  models: { general: string; generalAlt: string; code: string };
  availableModels: string[];
  features: { dailyBrief: boolean; webSearch: boolean };
  pushCount: number;
};

export type ModelSelection = { general: string; generalAlt: string; code: string };

/**
 * Charge une seule fois les informations d'execution (modeles, features, push)
 * et expose la selection de modeles editable, initialisee au chargement.
 */
export function useRuntimeInfo() {
  const [runtime, setRuntime] = useState<RuntimeInfo | null>(null);
  const [models, setModels] = useState<ModelSelection | null>(null);

  useEffect(() => {
    import("@/app/actions/settings")
      .then(({ loadRuntimeInfo }) => loadRuntimeInfo())
      .then((info) => {
        setRuntime(info);
        setModels({
          general: info.models.general,
          generalAlt: info.models.generalAlt,
          code: info.models.code,
        });
      })
      .catch(() => {});
  }, []);

  return { runtime, models, setModels };
}
