// Genere un data/ factice pour captures d'ecran du README.
// NE JAMAIS committer. Regenerer avec : node scripts/fake-data.mjs
import fs from "fs";
import path from "path";

const DATA = path.join(process.cwd(), "data");
fs.mkdirSync(DATA, { recursive: true });

const now = Date.now();
const iso = (ms) => new Date(ms).toISOString();
const write = (name, obj) =>
  fs.writeFileSync(path.join(DATA, name), JSON.stringify(obj, null, 2));

// --- Schedule : semaine pleine autour d'aujourd'hui, subjects generiques
const COURSES = [
  { subject: "Algorithmique avancee", room: "Salle B12, Batiment A", h: 9, d: 1, dur: 2 },
  { subject: "Bases de donnees", room: "Salle 204, Batiment B", h: 14, d: 1, dur: 2 },
  { subject: "Developpement web", room: "Salle C07, Batiment A", h: 10, d: 2, dur: 2 },
  { subject: "Reseaux", room: "Salle 110, Batiment C", h: 15, d: 2, dur: 1.5 },
  { subject: "Intelligence artificielle", room: "Salle A03, Batiment A", h: 9, d: 3, dur: 2 },
  { subject: "Anglais technique", room: "Salle 008, Batiment B", h: 13, d: 3, dur: 1.5 },
  { subject: "Genie logiciel", room: "Salle 301, Batiment C", h: 9, d: 4, dur: 2 },
  { subject: "Projet tutoré", room: "Salle 210, Batiment B", h: 14, d: 4, dur: 3 },
  { subject: "Systemes distribues", room: "Salle 115, Batiment C", h: 9, d: 5, dur: 2 },
  { subject: "Atelier professionnel", room: "Salle 002, Batiment A", h: 14, d: 5, dur: 2 },
];

const day = (offset) => {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d;
};

const courses = COURSES.map((c, i) => {
  const d = day(c.d);
  d.setHours(c.h, 0, 0, 0);
  const start = d.getTime();
  return {
    uuid: `demo-${i}`,
    subject: c.subject,
    teacher: "Equipe pedagogique",
    room: c.room,
    start,
    end: start + c.dur * 3600 * 1000,
    lessonType: "Seance de cours",
    cancelled: false,
    remote: false,
    description: "Seance de cours",
    group: "L3 Developpement",
  };
});
write("schedule.json", { syncedAt: iso(now), ok: true, courses });

// --- Reminders : overdue + aujourd'hui + demain, libelles generiques
const overdue = [
  "Relire le plan du projet",
  "Renvoyer le questionnaire de suivi",
  "Preparer la presentation de mi-parcours",
  "Verifier les sources du rapport",
  "Completer le formulaire de bourse",
];
const soon = [
  "Envoyer le CV a l entreprise",
  "Relire les notes du cours d hier",
  "Commander le materiel manquant",
  "Repondre au message du tuteur",
  "Mettre a jour le portfolio",
];

const reminders = [
  ...overdue.map((title, i) => ({
    id: `demo-ov-${i}`,
    title,
    dueAt: iso(now - (i + 1) * 86400000 * 1.4),
    status: "pending",
    createdAt: iso(now - (i + 3) * 86400000),
  })),
  ...soon.map((title, i) => ({
    id: `demo-sn-${i}`,
    title,
    dueAt: iso(now + (i + 1) * 3600 * 1000 * 5),
    status: "pending",
    createdAt: iso(now - 86400000),
  })),
];
write("reminders.json", { reminders });

// --- Memory : structure complete (facts + relationships + profile requis)
const FACTS = [
  { content: "Preference d edition : markdown", category: "preference" },
  { content: "Objectif : obtenir une alternance en L3", category: "dev" },
  { content: "Technos apprises recemment : SSE et WebAuthn", category: "dev" },
  { content: "Langue de travail : francais, anglais B2", category: "life" },
  { content: "Projet photo : suivi de shoootings de concerts", category: "photo" },
  { content: "Habituellement en reveil tardif, prefere les matins calmes", category: "preference" },
];
write("memory.json", {
  profile: { name: "Demo", preferences: ["Markdown", "Francais"] },
  relationships: [],
  facts: FACTS.map((f, i) => ({
    id: `m${i}`,
    content: f.content,
    category: f.category,
    createdAt: iso(now - (i + 1) * 86400000 * 3),
    source: "manual",
    confidence: 0.9,
    accessCount: i + 1,
  })),
});

// --- Emails : generiques, aucun sender reel
write("emails.json", {
  emails: [
    { id: "e1", from: "notifications@exemple-universitaire.fr", subject: "Emploi du temps mis a jour", snippet: "Les seances de la semaine prochaine sont disponibles.", date: iso(now - 3600000) },
    { id: "e2", from: "no-reply@exemple-outil.fr", subject: "Votre reservation est confirmee", snippet: "Votre reservation de salle a bien ete enregistree.", date: iso(now - 7200000) },
    { id: "e3", from: "bourse@exemple-universitaire.fr", subject: "Dossier incomplet", snippet: "Merci de completer une piece manquante avant la date limite.", date: iso(now - 86400000) },
  ],
});

// --- LeetCode : compteurs generiques
write("leetcode.json", {
  leetcodeUsername: "demo-user",
  totalSolved: 148,
  easySolved: 82,
  mediumSolved: 52,
  hardSolved: 14,
  ranking: 42187,
  totalSubmissions: 3120,
  streak: 12,
  history: [],
  exercises: [],
  // syncedAt recent : empeche loadLeetcode() de tenter un vrai appel API
  // (le pseudo "demo-user" n'existe pas et afficherait un bandeau d'erreur).
  syncedAt: iso(now),
});

// --- Watch later / accredits / gallery : vides mais valides
write("watch-later.json", { items: [] });
write("accreditations.json", { accreditations: [] });
write("gallery.json", { shoots: [] });
write("photo-shoots.json", { shoots: [] });
write("concerts.json", { concerts: [] });
write("intentions.json", { intentions: [] });
write("activity.json", { entries: [] });
write("chat-history.json", { conversations: [] });
write("config.json", { accent: "#d4a373", theme: "dark" });
write("consent.json", { aiConsent: true, consentedAt: iso(now) });
write("notified-reminders.json", { ids: [] });
write("notified-courses.json", { uuids: [] });
write("push-subscriptions.json", { subscriptions: [] });
write("users.json", { users: [{ id: "owner", name: "Demo", email: "demo@exemple.fr" }] });
write("server-cache.json", {});
write("daily-briefs.json", { briefs: [] });

console.log("data factice genere :", fs.readdirSync(DATA).length, "fichiers");
