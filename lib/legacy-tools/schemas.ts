import type { UnifiedTool } from "@/lib/ai-providers";

/**
 * Schémas des outils historiques du noyau, pas encore migrés en modules.
 *
 * Ce fichier est transitoire : chaque domaine migré retire ses schémas d'ici
 * (phase 6 de #84). Il ne contient aucune logique, seulement la description
 * exposée au modèle.
 */
export const legacyTools: UnifiedTool[] = [
  {
    name: "add_memory_fact",
    description:
      "Memorise un fait durable et stable sur l'utilisateur (preference, contrainte, materiel, competence, evenement important) pour les futures conversations. " +
      "A utiliser des que l'utilisateur te confie ce type d'information, MEME S'IL NE LE DEMANDE PAS. " +
      "Ne pas utiliser pour une demande ponctuelle, une salutation ou une tache deja couverte par un rappel ou un evenement agenda.",
    parameters: {
      type: "object",
      properties: {
        content: { type: "string", description: "Le fait a memoriser, en francais, a la troisieme personne" },
        category: {
          type: "string",
          enum: ["dev", "photo", "life", "preference"],
          description:
            "dev = preferences/competences techniques, photo = materiel/style/workflow, " +
            "life = habitudes/contraintes/contexte, preference = preferences generales",
        },
      },
      required: ["content", "category"],
    },
  },
  {
    name: "scan_accreditations",
    description: "Analyse les emails Gmail pour trouver des demandes d'accreditation (mots-cles: accreditation, photo pass, press). Extrait artiste, lieu, date, statut et cree/met a jour les fiches dans accreditations.json.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "add_photo_shoot",
    description: "Ajoute un nouveau shooting photo au suivi. Si l'utilisateur ne precise pas de statut, il est automatique : 'done' si la date est passee/aujourd'hui, 'upcoming' si future. Deduis le statut des paroles de l'utilisateur : ex. 'deja sur mon PC' -> 'on_pc', 'photos deja envoyees' -> 'sent', 'retouche' -> 'edited', 'exporte' -> 'exported', 'trie' -> 'sorted', 'fait/termine' -> 'done'. Statuts: upcoming, done, on_pc, sorted, edited, exported, sent.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "Titre du shooting (ex: 'Concert Mariane')" },
        date: { type: "string", description: "Date du shooting au format YYYY-MM-DD" },
        client: { type: "string", description: "Nom du client/artiste" },
        notes: { type: "string", description: "Notes optionnelles" },
        status: { type: "string", enum: ["upcoming", "done", "on_pc", "sorted", "edited", "exported", "sent"], description: "Statut si l'utilisateur le precise, sinon laisse vide pour le comportement automatique" },
      },
      required: ["title", "date", "client"],
    },
  },
  {
    name: "update_photo_shoot",
    description: "Met a jour le statut ou les infos d'un shooting photo. Utilise 'list_photo_shoots' d'abord pour trouver l'ID.",
    parameters: {
      type: "object",
      properties: {
        id: { type: "string", description: "ID du shooting" },
        status: { type: "string", enum: ["upcoming", "done", "on_pc", "sorted", "edited", "exported", "sent"], description: "Nouveau statut" },
        galleryLink: { type: "string", description: "Lien galerie (quand status='sent')" },
        photosSent: { type: "number", description: "Nombre de photos envoyees (quand status='sent')" },
      },
      required: ["id"],
    },
  },
  {
    name: "list_photo_shoots",
    description: "Liste tous les shootings photo avec leur statut, date et client.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];
