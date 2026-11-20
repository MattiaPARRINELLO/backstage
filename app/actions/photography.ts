"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { actionInput } from "@/lib/action";
import {
  getPhotoShoots,
  addPhotoShoot,
  updatePhotoShoot,
  deletePhotoShoot,
  logActivity,
} from "@/lib/storage";
import type { PhotoShootStatus } from "@/lib/types";

const emptyInput = z.object({});
const idInput = z.string().min(1, "Identifiant requis");

const createPhotoShootSchema = z.object({
  title: z.string().trim().min(1, "Titre requis"),
  date: z.string().trim().min(1, "Date requise").refine(
    (v) => !Number.isNaN(new Date(v).getTime()),
    "Date invalide"
  ),
  client: z.string().trim().min(1, "Client requis"),
  notes: z.string().trim().optional(),
});

const photoShootStatusSchema = z.enum([
  "upcoming", "done", "on_pc", "sorted", "edited", "exported", "sent",
]);

const updatePhotoShootSchema = z
  .object({
    status: photoShootStatusSchema.optional(),
    title: z.string().trim().optional(),
    date: z.string().trim().optional(),
    client: z.string().trim().optional(),
    notes: z.string().trim().optional(),
    galleryLink: z.string().url("Lien invalide").optional().or(z.literal("")),
    photosSent: z.number().int().min(0).optional(),
  })
  .strict();

export async function loadPhotoShoots() {
  await actionInput(emptyInput, {});
  return getPhotoShoots();
}

export async function createPhotoShoot(input: {
  title: string;
  date: string;
  client: string;
  notes?: string;
}) {
  const { data } = await actionInput(createPhotoShootSchema, input);
  const shoot = await addPhotoShoot(data);
  await logActivity("shoot_created", `Shooting : ${shoot.title} — ${shoot.client}`, shoot.date);
  revalidatePath("/photos");
  return shoot;
}

export async function editPhotoShoot(
  id: string,
  updates: Partial<{
    status: PhotoShootStatus;
    title: string;
    date: string;
    client: string;
    notes: string;
    galleryLink: string;
    photosSent: number;
  }>
) {
  const { data: shootId } = await actionInput(idInput, id);
  const { data } = await actionInput(updatePhotoShootSchema, updates);
  const shoot = await updatePhotoShoot(shootId, {
    ...data,
    galleryLink: data.galleryLink || undefined,
  });
  if (shoot) await logActivity("shoot_updated", `Shooting mis à jour : ${shoot.title}`, shoot.status);
  revalidatePath("/photos");
  return shoot;
}

export async function removePhotoShoot(id: string): Promise<boolean> {
  const { data } = await actionInput(idInput, id);
  const ok = await deletePhotoShoot(data);
  if (ok) await logActivity("shoot_deleted", "Shooting supprimé", data);
  revalidatePath("/photos");
  return ok;
}
