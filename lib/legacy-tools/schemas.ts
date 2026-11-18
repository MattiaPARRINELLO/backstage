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
    name: "fetch_and_search_emails",
    description: "Recupere les emails Gmail (recus et envoyes) et cherche par mot-cle dans les expediteurs, destinataires, sujets ou contenus. Utilise 'in:sent' pour les mails envoyes, 'is:unread' pour les non-lus. Renvoie au maximum 10 messages, tries par date decroissante (le plus recent d'abord) ; sans mot-cle, ce sont donc les 10 derniers emails.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Mot-cle de recherche (optionnel)" },
      },
      required: [],
    },
  },
  {
    name: "send_email_response",
    description: "Envoie une reponse a un email existant via Gmail.",
    parameters: {
      type: "object",
      properties: {
        email_id: { type: "string", description: "ID de l'email auquel repondre" },
        response_text: { type: "string", description: "Texte complet de la reponse" },
      },
      required: ["email_id", "response_text"],
    },
  },
  {
    name: "triage_emails",
    description: "Analyse les emails non lus et les classe par priorite (urgent, newsletter, billetterie, personnel).",
    parameters: {
      type: "object",
      properties: {
        max_results: { type: "number", description: "Nombre max d'emails a analyser (defaut: 10)" },
      },
      required: [],
    },
  },
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
