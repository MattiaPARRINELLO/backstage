import { z } from "zod";
import { defineTool, toolEmpty, toolError, toolOk } from "@backstage/module-kit";

import {
  formatCourse,
  getCourses,
  getCoursesForDay,
  getNextCourse,
  getUpcomingCourses,
} from "@/lib/storage/schedule";

const scopeSchema = z.enum(["today", "tomorrow", "week", "next"]);

/**
 * Emploi du temps CESAR.
 *
 * Logique reprise à l'identique du dispatch du noyau. Le statut `empty` est
 * conservé pour « pas de cours » : la règle d'honnêteté interdit de combler un
 * vide par une invention.
 */
export const getScheduleTool = defineTool({
  name: "get",
  description:
    "Emploi du temps de l'utilisateur (cours du format CESAR). scope='today' → les cours du jour ; scope='tomorrow' → ceux du lendemain ; scope='week' → cours des 7 prochains jours ; scope='next' → le prochain cours, avec subject optionnel pour filtrer une matiere. Utilise 'next' pour toute question sur la salle, l'heure ou le lieu du cours en cours ou a venir (ex: 'c'est dans quelle salle mon cours ?', 'je dois aller ou ?'). Retourne matiere, horaires, salle et prof.",
  params: z.object({
    scope: scopeSchema.default("next"),
    subject: z.string().optional(),
  }),
  sideEffect: "read",
  run: async (args) => {
    const courses = await getCourses();
    if (!courses.length) {
      return toolError("Emploi du temps inconnu (aucun sync CESAR effectue).");
    }

    const { scope, subject } = args;

    if (scope === "next") {
      const next = getNextCourse(courses, subject);
      if (!next) {
        return toolEmpty(
          subject ? `Aucun cours a venir pour "${subject}".` : "Aucun cours a venir."
        );
      }
      return toolOk(
        `Prochain cours${subject ? ` (${subject})` : ""} :\n${formatCourse(next)}`
      );
    }

    const isoDay = (offset: number) => {
      const day = new Date();
      day.setDate(day.getDate() + offset);
      return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(
        day.getDate()
      ).padStart(2, "0")}`;
    };

    if (scope === "today" || scope === "tomorrow") {
      const offset = scope === "tomorrow" ? 1 : 0;
      const day = getCoursesForDay(courses, isoDay(offset));
      if (!day.length) {
        return toolEmpty(
          offset === 1 ? "Pas de cours demain." : "Pas de cours aujourd'hui."
        );
      }
      const label =
        offset === 1
          ? new Date(Date.now() + 86_400_000).toLocaleDateString("fr-FR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })
          : "aujourd'hui";
      return toolOk(`Cours ${label} :\n${day.map(formatCourse).join("\n")}`);
    }

    // week : cours restants de la semaine en cours
    const now = new Date();
    const nowMs = Date.now();
    const upcoming = getUpcomingCourses(courses, nowMs).filter((course) => {
      const start = new Date(course.start);
      const diffDays = Math.floor(
        (new Date(course.start).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) /
          86_400_000
      );
      return diffDays < 7 && start.getTime() >= nowMs - 86_400_000;
    });
    if (!upcoming.length) return toolEmpty("Pas de cours a venir cette semaine.");
    return toolOk(
      `Cours a venir (7 jours) :\n${upcoming.slice(0, 40).map(formatCourse).join("\n")}`
    );
  },
});
