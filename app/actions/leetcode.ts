"use server";

import { z } from "zod";

import { actionInput } from "@/lib/action";
import { AppError } from "@/lib/errors";

import { getLeetcode, saveLeetcode, addLeetcodeExercise, logActivity, getCalendar } from "@/lib/storage";
import { fetchLeetCodeProfile, type LeetCodeSyncData } from "@/lib/leetcode-api";
import type { LeetcodeData, LeetcodeExercise } from "@/lib/types";
import { findFreeSlots } from "@/lib/leetcode-utils";

const emptyInput = z.object({});
const usernameInput = z.string().trim().min(1, "Username requis").max(50, "Username trop long");

const exerciseInput = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  difficulty: z.enum(["Easy", "Medium", "Hard"]).optional(),
  duration: z.number().nonnegative().optional(),
  code: z.string(),
  response: z.string(),
  createdAt: z.string(),
});

const dataInput = z.object({
  streak: z.number().int().nonnegative(),
  history: z
    .array(z.object({ date: z.string(), solved: z.boolean() }))
    .max(5000),
  exercises: z.array(exerciseInput).max(5000),
  leetcodeUsername: z.string().optional(),
  totalSolved: z.number().nonnegative().optional(),
  easySolved: z.number().nonnegative().optional(),
  mediumSolved: z.number().nonnegative().optional(),
  hardSolved: z.number().nonnegative().optional(),
  ranking: z.number().nonnegative().optional(),
  totalSubmissions: z.number().nonnegative().optional(),
  submissions: z
    .object({
      calendar: z.record(z.string(), z.number()),
      activeYears: z.array(z.number()),
      totalActiveDays: z.number(),
    })
    .optional(),
  contest: z
    .object({
      attended: z.number(),
      rating: z.number(),
      globalRanking: z.number(),
      topPercentage: z.number(),
      badge: z.string().optional(),
    })
    .optional(),
  syncedAt: z.string().optional(),
  syncError: z.string().optional(),
});

/**
 * Durée de validité d'un sync. Remplace l'ancien déclencheur `streak === 0`,
 * qui figeait définitivement des chiffres périmés dès le premier succès.
 */
const SYNC_TTL_MS = 30 * 60 * 1000;

function withSync(data: LeetcodeData, synced: LeetCodeSyncData): LeetcodeData {
  return {
    ...data,
    streak: synced.streak,
    totalSolved: synced.totalSolved,
    easySolved: synced.easySolved,
    mediumSolved: synced.mediumSolved,
    hardSolved: synced.hardSolved,
    ranking: synced.ranking,
    totalSubmissions: synced.totalSubmissions,
    submissions: synced.submissions,
    contest: synced.contest,
    syncedAt: new Date().toISOString(),
    syncError: undefined,
  };
}

function isStale(data: LeetcodeData): boolean {
  if (!data.syncedAt) return true;
  const at = new Date(data.syncedAt).getTime();
  return !Number.isFinite(at) || Date.now() - at > SYNC_TTL_MS;
}

export async function loadLeetcode(): Promise<LeetcodeData> {
  await actionInput(emptyInput, {});
  const data = await getLeetcode();

  // Sans pseudo, rien à synchroniser : on renvoie l'état local tel quel.
  if (!data.leetcodeUsername || !isStale(data)) {
    return { ...data, syncError: undefined };
  }

  try {
    const synced = await fetchLeetCodeProfile(data.leetcodeUsername);
    const updated = withSync(data, synced);
    await saveLeetcode(updated);
    return { ...updated, syncError: undefined };
  } catch (error) {
    // Un échec de sync ne doit pas casser l'affichage, mais il doit se voir :
    // l'ancien `catch {}` vide masquait la panne depuis des mois.
    const message = error instanceof Error ? error.message : "Synchronisation LeetCode impossible";
    console.warn(`[leetcode] sync echouee : ${message}`);
    return { ...data, syncError: message };
  }
}

export async function saveLeetcodeData(data: LeetcodeData): Promise<void> {
  const { data: valid } = await actionInput(dataInput, data);
  await saveLeetcode(valid as LeetcodeData);
}

export async function storeExercise(exercise: LeetcodeExercise): Promise<void> {
  const { data } = await actionInput(exerciseInput, exercise);
  await addLeetcodeExercise(data as LeetcodeExercise);
  await logActivity("leetcode_solved", `Exercice LeetCode : ${data.title}`);
}

export async function syncLeetcode(): Promise<LeetcodeData> {
  await actionInput(emptyInput, {});
  const data = await getLeetcode();
  const username = data.leetcodeUsername;
  if (!username) throw new AppError("validation", "Aucun username LeetCode configuré");

  const synced = await fetchLeetCodeProfile(username);
  const updated = withSync(data, synced);
  await saveLeetcode(updated);
  return updated;
}

export async function getSmartSuggestion(): Promise<string> {
  await actionInput(emptyInput, {});
  const lec = await getLeetcode();
  const calendarEvents = await getCalendar().catch(() => []);
  const now = new Date();
  const todayEvents = calendarEvents.filter((e) => e.date.startsWith(now.toISOString().slice(0, 10)));
  const freeSlots = findFreeSlots(todayEvents, now);

  let difficulty = "Easy";
  let timeMin = 15;
  if (freeSlots.length > 0) {
    const longestFree = Math.max(...freeSlots.map((s) => s.duration));
    if (longestFree >= 60) { difficulty = "Hard"; timeMin = 60; }
    else if (longestFree >= 30) { difficulty = "Medium"; timeMin = 30; }
  }

  const easyCount = lec.easySolved ?? 0;
  const mediumCount = lec.mediumSolved ?? 0;
  const hardCount = lec.hardSolved ?? 0;
  const total = lec.totalSolved ?? 1;

  let suggestion = `Créneau libre détecté (~${timeMin} min) → `;
  if (difficulty === "Easy") suggestion += "Problème Easy recommandé";
  else if (difficulty === "Medium") suggestion += "Problème Medium recommandé";
  else suggestion += "Problème Hard recommandé (1h)";

  suggestion += `\nStreak: ${lec.streak} jours · Résolus: ${total} (E:${easyCount}/M:${mediumCount}/H:${hardCount})`;
  return suggestion;
}

export async function setLeetcodeUsername(username: string): Promise<LeetcodeData> {
  const { data: cleaned } = await actionInput(usernameInput, username);

  // Le pseudo est vérifié auprès de l'API **avant** d'être enregistré : un
  // pseudo inexistant ne doit pas laisser la config dans un état inutilisable.
  const synced = await fetchLeetCodeProfile(cleaned);
  const data = await getLeetcode();
  const updated = { ...withSync(data, synced), leetcodeUsername: synced.username };
  await saveLeetcode(updated);
  return updated;
}
