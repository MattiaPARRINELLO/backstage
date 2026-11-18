import { z } from "zod";
import { defineTool, toolEmpty, toolOk } from "@backstage/module-kit";

import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  fetchGoogleCalendarEvents,
  updateGoogleCalendarEvent,
} from "@/lib/google-actions";

/**
 * Google Calendar : creation, modification, suppression et recherche.
 *
 * Les trois ecritures sont `external` mais sans confirmation permanente : le
 * comportement historique est conserve, et le module peut retirer cette
 * confirmation par defaut (ADR 0001, decision D). Une provenance contaminee
 * les met en attente.
 */

const COLOR_HELP =
  "Couleur Google Calendar (optionnel). Valeurs : 1=Lavande, 2=Sauge, 3=Raisin, 4=Flamant, 5=Banane, 6=Mandarine, 7=Paon, 8=Graphite, 9=Myrtille, 10=Basilic, 11=Tomate.";

export const createCalendarEventTool = defineTool({
  name: "create",
  description: "Cree un evenement dans le vrai Google Calendar.",
  params: z.object({
    title: z.string().trim().min(1, "Titre requis"),
    start_time: z.string().min(1, "Date de debut requise"),
    end_time: z.string().min(1, "Date de fin requise"),
    location: z.string().optional(),
    color_id: z.string().optional().describe(COLOR_HELP),
  }),
  sideEffect: "external",
  requiresConfirmation: false,
  describeAction: (args) =>
    `Créer l'événement « ${String(args.title ?? "")} » du ${String(
      args.start_time ?? "?"
    )} au ${String(args.end_time ?? "?")}`,
  run: async (args) => {
    const eventId = await createGoogleCalendarEvent(
      args.title,
      args.start_time,
      args.end_time,
      args.location,
      undefined,
      args.color_id
    );
    const color = args.color_id ? " Couleur appliquee." : "";
    return toolOk(
      `Evenement "${args.title}" cree dans Google Calendar (id: ${eventId}).${color}`
    );
  },
});

export const updateCalendarEventTool = defineTool({
  name: "update",
  description:
    "Modifie un evenement existant dans Google Calendar (titre, description, lieu, couleur). Utilise d'abord calendar.search pour trouver l'ID de l'evenement.",
  params: z.object({
    event_id: z.string().min(1, "Identifiant de l'evenement requis"),
    title: z.string().optional(),
    description: z.string().optional(),
    location: z.string().optional(),
    color_id: z.string().optional(),
  }),
  sideEffect: "external",
  requiresConfirmation: false,
  describeAction: (args) =>
    `Modifier l'événement ${String(args.event_id ?? "?")}${
      args.title ? ` → « ${String(args.title)} »` : ""
    }`,
  run: async (args) => {
    await updateGoogleCalendarEvent(args.event_id, {
      summary: args.title,
      description: args.description,
      location: args.location,
      colorId: args.color_id,
    });
    return toolOk(`Evenement mis a jour (id: ${args.event_id}).`);
  },
});

export const deleteCalendarEventTool = defineTool({
  name: "delete",
  description:
    "Supprime un evenement existant dans Google Calendar. Utilise d'abord calendar.search pour trouver l'ID de l'evenement.",
  params: z.object({
    event_id: z.string().min(1, "Identifiant de l'evenement requis"),
  }),
  sideEffect: "external",
  requiresConfirmation: false,
  describeAction: (args) => `Supprimer l'événement ${String(args.event_id ?? "?")}`,
  run: async (args) => {
    await deleteGoogleCalendarEvent(args.event_id);
    return toolOk(`Evenement supprime du Google Calendar (id: ${args.event_id}).`);
  },
});

export const searchCalendarEventsTool = defineTool({
  name: "search",
  description: "Cherche des evenements dans le calendrier Google (concerts, cours, reunions).",
  params: z.object({
    days: z.number().int().min(1).max(365).optional(),
  }),
  sideEffect: "read",
  trust: "untrusted",
  run: async (args) => {
    const days = args.days ?? 30;
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
    const events = await fetchGoogleCalendarEvents(timeMin, timeMax);
    if (events.length === 0) return toolEmpty("Aucun evenement trouve dans le calendrier.");

    return toolOk(
      events
        .map(
          (event) =>
            `- ${event.summary} le ${new Date(event.start).toLocaleDateString("fr-FR")}${
              event.location ? ` (${event.location})` : ""
            }`
        )
        .join("\n")
    );
  },
});
