"use server";

/**
 * Emploi du temps CESAR : sync manuelle + lecture pour les pages.
 * Le scheduler (instrumentation) resynchronise automatiquement si périmé (> 6 h).
 */
import { z } from "zod";
import { revalidatePath } from "next/cache";

import { actionInput } from "@/lib/action";
import { AppError } from "@/lib/errors";
import { getSchedule, syncSchedule, logActivity } from "@/lib/storage";
import type { ScheduleCourse, ScheduleData } from "@/lib/types";

const emptyInput = z.object({});

export async function getScheduleData(): Promise<ScheduleData> {
  await actionInput(emptyInput, {});
  return getSchedule();
}

export async function getScheduleCourses(): Promise<ScheduleCourse[]> {
  await actionInput(emptyInput, {});
  return (await getSchedule()).courses;
}

export async function syncScheduleNow(): Promise<ScheduleData> {
  await actionInput(emptyInput, {});

  const data = await syncSchedule();
  if (!data.ok) {
    throw new AppError("external_unavailable", data.error || "Synchronisation CESAR en echec");
  }

  await logActivity(
    "schedule_synced",
    `Emploi du temps synchronise : ${data.courses.length} seances`,
    `source CESAR`
  );
  revalidatePath("/schedule");
  revalidatePath("/today");

  return data;
}
