"use server";

import { z } from "zod";

import { actionInput } from "@/lib/action";
import { AppError } from "@/lib/errors";
import { getConfig, getModel, updateConfig } from "@/lib/app-config";
import { getSubscriptions } from "@/lib/push-subscriptions";
import { fetchAvailableModels } from "@/lib/ai-providers/models";

const emptyInput = z.object({});

// État d'exécution pour le tableau de santé des intégrations (Paramètres) :
// modèles IA configurés, fonctionnalités et nombre d'appareils push.
export async function loadRuntimeInfo(): Promise<{
  models: { general: string; generalAlt: string; code: string };
  availableModels: string[];
  features: { dailyBrief: boolean; webSearch: boolean };
  pushCount: number;
}> {
  await actionInput(emptyInput, {});
  const [config, subs, availableModels] = await Promise.all([
    getConfig(),
    getSubscriptions(),
    fetchAvailableModels(),
  ]);
  // `getModel` remplace et persiste un identifiant retire par le provider :
  // ouvrir les reglages suffit donc a reparer une config laissee avec un
  // modele mort, sans erreur au moment d'enregistrer.
  const [general, code] = await Promise.all([
    getModel("general"),
    getModel("code"),
  ]);
  return {
    models: {
      general: general.primary,
      generalAlt: general.alt,
      code: code.primary,
    },
    availableModels,
    features: config.features,
    pushCount: subs.length,
  };
}

const modelField = z
  .string()
  .trim()
  .min(1, "Modele requis")
  .max(100, "Nom de modele trop long");

const updateModelsSchema = z
  .object({
    general: modelField,
    generalAlt: modelField,
    code: modelField,
  })
  .strict();

// Met à jour les modèles IA (principal, secours, code) choisis par l'utilisateur.
export async function updateModels(input: {
  general: string;
  generalAlt: string;
  code: string;
}): Promise<{ general: string; generalAlt: string; code: string }> {
  const { data } = await actionInput(updateModelsSchema, input);
  const { general, generalAlt, code } = data;

  const available = await fetchAvailableModels();
  for (const m of [general, generalAlt, code]) {
    if (!available.includes(m)) {
      throw new AppError("validation", `Modele indisponible : ${m}`);
    }
  }

  await updateConfig({ models: { general, generalAlt, code } });
  return { general, generalAlt, code };
}
