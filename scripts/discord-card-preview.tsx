/**
 * Aperçu des cartes Discord (dev) : rend chaque type d'événement en PNG dans
 * test-results/discord-cards/ pour vérifier la mise en page sans envoyer de DM.
 *   bun scripts/discord-card-preview.tsx
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderEventCard } from "@/lib/discord/cards";
import type { DiscordEvent } from "@/lib/discord/types";

const now = Date.now();
const day = 86_400_000;

const events: DiscordEvent[] = [
  {
    kind: "daily-brief",
    summary:
      "## 3 choses aujourd'hui\n- Rendre le rapport de stage avant 18h\n- Cours de mathématiques en amphi B\n- Répondre à Mme Lambert (urgent)\n\nLa journée est dense mais sans conflit d'agenda.",
    digest: {
      date: new Date().toISOString().slice(0, 10),
      focus: "Rendre le rapport de stage avant 18h",
      weather: "12,4 °C (ressenti 11 °C), ciel couvert",
      courses: [
        { title: "Analyse numérique", time: "10:15", location: "Amphi B" },
        { title: "Anglais technique", time: "14:00", location: "Salle 204" },
      ],
      reminders: ["Rendre le rapport de stage", "Appeler le CROUS", "Renouveler l'abonnement"],
      agenda: ["18:00 — Point équipe projet", "20:30 — Concert au Trabendo"],
      urgentEmails: ["Relance facture SFM", "Deadline mémoire J-3"],
      unreadCount: 14,
      leetcode: "Two Sum (Easy)",
    },
  },
  {
    kind: "course",
    course: {
      uuid: "3",
      subject: "Analyse numérique et optimisation",
      teacher: "M. Dupont",
      room: "Amphi B, Bâtiment principal",
      start: now + 30 * 60_000,
      end: now + 2.5 * 3_600_000,
      lessonType: "Cours magistral",
      cancelled: false,
      remote: false,
      description: "",
      group: "G1",
    },
    leadMin: 30,
  },
  {
    kind: "reminder",
    reminder: {
      id: "r1",
      title: "Rendre le rapport de stage à Mme Lambert",
      notes: "Version PDF + annexes, dépôt sur la plateforme avant minuit.",
      dueAt: new Date(now + 45 * 60_000).toISOString(),
      status: "pending",
      createdAt: new Date(now - day).toISOString(),
    },
  },
  {
    kind: "intention",
    intention: {
      id: "i1",
      subject: "Relancer le photographe du festival",
      message: "Demander les RAW de la scène du samedi avant la livraison client.",
      dueAt: new Date(now + day).toISOString(),
      status: "pending",
      createdAt: new Date(now - 2 * day).toISOString(),
    },
  },
  {
    kind: "alert",
    module: "scheduler",
    message: "Push ÉCHEC 410 → https://fcm.googleapis.com/fcm/send/abcd…",
    detail: "Subscription expirée (410 Gone). L'appareil a été retiré de la liste.",
    level: "error",
  },
  { kind: "test" },
];

const outDir = path.join(process.cwd(), "test-results", "discord-cards");
await mkdir(outDir, { recursive: true });

for (const event of events) {
  const png = await renderEventCard(event);
  const file = path.join(outDir, `${event.kind}.png`);
  await writeFile(file, png);
  console.log(`${event.kind.padEnd(12)} → ${file} (${(png.byteLength / 1024).toFixed(1)} Ko)`);
}
