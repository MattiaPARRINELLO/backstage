import { z } from "zod";
import { defineTool, toolEmpty, toolError, toolOk, verifyWrite } from "@backstage/module-kit";

import { addPhotoShoot, getPhotoShoots, updatePhotoShoot } from "@/lib/storage";
import type { PhotoShootStatus } from "@/lib/types";

/**
 * Shootings photo : ajout, mise a jour et liste.
 *
 * Les deux ecritures sont verifiees par relecture : le modele ne peut pas
 * annoncer un shooting qui n'a pas ete enregistre.
 */

const statusSchema = z.enum([
  "upcoming",
  "done",
  "on_pc",
  "sorted",
  "edited",
  "exported",
  "sent",
]);

export const addPhotoShootTool = defineTool({
  name: "add",
  description:
    "Ajoute un nouveau shooting photo au suivi. Si l'utilisateur ne precise pas de statut, il est automatique : 'done' si la date est passee/aujourd'hui, 'upcoming' si future. Deduis le statut des paroles de l'utilisateur : ex. 'deja sur mon PC' -> 'on_pc', 'photos deja envoyees' -> 'sent', 'retouche' -> 'edited', 'exporte' -> 'exported', 'trie' -> 'sorted', 'fait/termine' -> 'done'. Statuts: upcoming, done, on_pc, sorted, edited, exported, sent.",
  params: z.object({
    title: z.string().trim().min(1, "Titre requis"),
    date: z.string().trim().min(1, "Date requise"),
    client: z.string().trim().min(1, "Client requis"),
    notes: z.string().trim().optional(),
    status: statusSchema.optional(),
  }),
  sideEffect: "write",
  run: async (args) => {
    const shoot = await addPhotoShoot({
      title: args.title,
      date: args.date,
      client: args.client,
      notes: args.notes,
      status: args.status,
    });

    const problem = await verifyWrite(`le shooting "${shoot.title}"`, async () => {
      const after = await getPhotoShoots();
      return after.shoots.some((entry) => entry.id === shoot.id);
    });
    if (problem) return toolError(problem);

    return toolOk(
      `Shooting ajouté : ${shoot.title} (${shoot.client}) le ${new Date(
        shoot.date
      ).toLocaleDateString("fr-FR")} [${shoot.status}]`
    );
  },
});

export const updatePhotoShootTool = defineTool({
  name: "update",
  description:
    "Met a jour le statut ou les infos d'un shooting photo. Utilise 'photo.list' d'abord pour trouver l'ID.",
  params: z.object({
    id: z.string().trim().min(1, "Identifiant requis"),
    status: statusSchema.optional(),
    galleryLink: z.string().optional(),
    photosSent: z.number().int().min(0).optional(),
  }),
  sideEffect: "write",
  run: async (args) => {
    const updates: Parameters<typeof updatePhotoShoot>[1] = {};
    if (args.status) updates.status = args.status as PhotoShootStatus;
    if (args.galleryLink) updates.galleryLink = args.galleryLink;
    if (args.photosSent !== undefined) updates.photosSent = args.photosSent;

    const updated = await updatePhotoShoot(args.id, updates);
    if (!updated) return toolEmpty("Shooting introuvable.");

    const gallery = updated.galleryLink ? ` (galerie: ${updated.galleryLink})` : "";
    const photos = updated.photosSent ? ` (${updated.photosSent} photos)` : "";
    return toolOk(`Shooting mis à jour : ${updated.title} → ${updated.status}${gallery}${photos}`);
  },
});

export const listPhotoShootsTool = defineTool({
  name: "list",
  description: "Liste tous les shootings photo avec leur statut, date et client.",
  params: z.object({}),
  sideEffect: "read",
  run: async () => {
    const data = await getPhotoShoots();
    if (data.shoots.length === 0) return toolEmpty("Aucun shooting photo enregistré.");

    return toolOk(
      data.shoots
        .map(
          (shoot) =>
            `- ${shoot.title} (${shoot.client}) le ${new Date(shoot.date).toLocaleDateString(
              "fr-FR"
            )} [${shoot.status}]${shoot.galleryLink ? ` - ${shoot.galleryLink}` : ""}${
              shoot.photosSent ? ` - ${shoot.photosSent} photos` : ""
            }`
        )
        .join("\n")
    );
  },
});
