// ============================================================
// CONTENU ÉDITORIAL DE LA LANDING BACKSTAGE.
// Positionnement : un espace personnel qui relie les morceaux
// d'une journée et s'en souvient. Toutes les données de
// démonstration sont FICTIVES et signalées comme telles.
// Modifier ce fichier suffit pour changer tous les textes.
// ============================================================

import { SITE_URL } from "@/lib/site-url";

export const GITHUB_URL = "https://github.com/MattiaPARRINELLO/backstage";
/** Guide d'auto-hébergement (licence MIT, Docker, variables, backups). */
export const SELF_HOST_URL =
  "https://github.com/MattiaPARRINELLO/backstage/blob/main/docs/self-hosting.md";
/** Roadmap multi-utilisateurs et BYOK, sur la branche de développement. */
export const ROADMAP_URL =
  "https://github.com/MattiaPARRINELLO/backstage/blob/feat/multi-utilisateurs-byok/docs/roadmap-multi-utilisateurs.md";
export const LICENSE_LABEL = "MIT";
/** Commande d'installation en une ligne, servie par /install.sh. */
export const INSTALL_COMMAND = `curl -fsSL ${SITE_URL}/install.sh | bash`;

export const NAV_LINKS = [
  { href: "#hero", label: "Produit" },
  { href: "#memoire", label: "Mémoire" },
  { href: "#journee", label: "Une journée" },
  { href: "#demo", label: "Démo" },
  { href: "#comptes", label: "Comptes" },
  { href: "#chez-vous", label: "Auto-hébergement" },
] as const;

// --- Hero -----------------------------------------------------

export const HERO = {
  title: "Votre contexte, en un seul endroit.",
  description:
    "Backstage réunit vos mails, vos cours, votre agenda, vos photos et une IA qui s'en souvient. Un espace privé, installé chez vous.",
  primaryCta: "Essayer la démo",
  secondaryCta: "Voir le code",
  loginCta: "Se connecter",
  note: "Démonstration publique à données fictives · Comptes publics en préparation",
  shot: {
    src: "/screenshots/hero-flux.jpg",
    alt: "L'application Backstage ouverte sur le chat, avec à droite le panneau de flux : cours du lendemain, rappels en retard et mails non lus.",
    caption: "Le chat au centre, le flux de la journée à droite.",
  },
} as const;

// --- Contexte relié -------------------------------------------

export const CONTEXT = {
  label: "Contexte relié",
  title: "Une question. Quatre morceaux s'assemblent.",
  lead: "Backstage ne fouille pas un seul dossier : il réunit ce que l'agenda, la boîte mail, les notes et les rappels savent déjà, puis il répond.",
  question: "Qu'est-ce que je dois préparer pour mon shooting de demain ?",
  fragments: [
    { kind: "Agenda", text: "Shooting jeudi 20:30, Le Transbordeur" },
    { kind: "Mail", text: "Claire V. : accréditation au nom du média, à retirer sur place" },
    { kind: "Note", text: "Fosse : 3 titres, puis côté scène" },
    { kind: "Rappel", text: "Charger batteries et cartes CF ce soir" },
  ],
  answer:
    "Jeudi 20:30 au Transbordeur. L'accréditation est au nom du média, à retirer sur place ; accès fosse sur les 3 premiers titres, puis côté scène. Batteries et cartes CF à charger ce soir.",
  foot: "Quatre éléments de l'espace réunis en une réponse · exemple fictif",
} as const;

// --- Ce qu'il tient ensemble -----------------------------------

export type ModuleItem = {
  name: string;
  /** Deux ou trois mots, pour l'index du premier écran. */
  short: string;
  line: string;
};

export const MODULES = {
  title: "Ce qu'il tient ensemble.",
  lead: "Six domaines, un seul espace. Chaque bloc correspond à un écran qui existe déjà dans l'application.",
  items: [
    {
      name: "Mails",
      short: "Boîte résumée",
      line: "La boîte Gmail résumée dans la conversation, sans changer d'onglet.",
    },
    {
      name: "Agenda",
      short: "Cours, rappels",
      line: "Une seule ligne de temps, groupée par jour, avec un bloc pour ce qui est en retard.",
    },
    {
      name: "Mémoire",
      short: "Faits éditables",
      line: "Ce que l'IA a retenu, fait par fait : chaque ligne est modifiable et supprimable.",
    },
    {
      name: "Shootings",
      short: "Shoot → livraison",
      line: "Salles, accréditations, contacts et séries, du jour du shoot à la livraison.",
    },
    {
      name: "Code",
      short: "Un problème par jour",
      line: "Un problème quotidien, et une aide qui connaît déjà votre niveau et vos objectifs.",
    },
    {
      name: "Chez vous",
      short: "Fichiers locaux",
      line: "Les données vivent dans un dossier local. Pas de compte à créer chez un tiers.",
    },
  ] satisfies ModuleItem[],
} as const;

// --- Mémoire ----------------------------------------------------

export const MEMORY = {
  factsLabel: "Mémoire · 3 faits",
  facts: [
    { kind: "Contact", text: "Claire V., attachée de presse — accréditations" },
    { kind: "Préférence", text: "Objectif lumineux privilégié en fosse" },
    { kind: "Projet", text: "Série « Scène 2025 », livraison en cours" },
  ],
  title: "Elle se souvient. Vous pouvez vérifier.",
  lead: "Une conversation ne s'arrête plus à sa dernière ligne. Les faits utiles sont écrits, dédoublonnés, puis relus : ce qui est retenu reste visible et corrigeable.",
  principles: [
    {
      title: "Se souvenir",
      desc: "Préférences, décisions, contacts : les éléments durables survivent à la conversation qui les a vus naître.",
    },
    {
      title: "Relier",
      desc: "Un fait sur une personne, une date ou un projet rejoint les autres. Une question sur un événement retrouve ce qui s'y rapporte.",
    },
    {
      title: "Garder le contrôle",
      desc: "La mémoire n'est pas une boîte noire : elle se lit, s'édite et se supprime depuis l'interface.",
    },
  ],
} as const;

// --- Une journée avec Backstage (scrollytelling) — données fictives
// ⚠️ DONNÉES DE DÉMONSTRATION — entièrement fictives.
// Le temps AVANCE d'une étape à l'autre : on suit une personne de
// 08:42 la veille du shooting jusqu'au lendemain matin.

export const DAY_STORY = {
  title: "Cinq fois le même contexte.",
  lead: "De la veille au lendemain matin : chaque heure retrouve ce qui a déjà été dit.",
  disclaimer: "Exemple illustratif, données fictives.",
  beats: [
    {
      time: "08:42",
      when: "La veille du shooting",
      query: "Qu'est-ce que je dois préparer pour mon shooting de demain ?",
      connections: [
        { kind: "Événement", text: "Shooting : Le Transbordeur, jeudi 20:30" },
        { kind: "Email", text: "Claire V. : « Accréditation au nom du média, retrait sur place »" },
        { kind: "Note", text: "Accès fosse 3 premiers titres, puis côté scène" },
        { kind: "Rappel", text: "Charger batteries + 2 cartes CF la veille" },
      ],
      answer:
        "Votre shooting est jeudi à 20:30 au Transbordeur. L'accréditation est au nom du média, à retirer sur place (email de Claire V.) ; en fosse : 3 premiers titres, puis accès côté scène. Pensez à charger les batteries et les cartes CF ce soir.",
      nextStep: {
        label: "Prochaine étape suggérée",
        text: "Ajouter un rappel « partir 45 min avant » pour jeudi ?",
        confirm: "Ajouter le rappel",
        dismiss: "Pas nécessaire",
        confirmed: "Rappel ajouté à votre liste (dans la démo uniquement).",
        dismissed: "D'accord, aucune action effectuée.",
      },
    },
    {
      time: "12:15",
      when: "Pause déjeuner",
      query: "J'ai une fenêtre ce midi, par quoi je commence ?",
      connections: [
        { kind: "Rappel", text: "Confirmer l'accréditation auprès de Claire V." },
        { kind: "Email", text: "Brouillon rédigé hier, à envoyer" },
        { kind: "Mémoire", text: "Préférence : répondre aux attachés de presse le matin" },
      ],
      answer:
        "Commencez par l'accréditation : un brouillon de réponse à Claire V. est déjà prêt dans vos emails. Vos notes indiquent que vous répondez aux attachés de presse le matin, parfait pour cette fenêtre. Le matériel peut attendre ce soir.",
      nextStep: {
        label: "Action suggérée",
        text: "Envoyer le brouillon de réponse à Claire V. ?",
        confirm: "Envoyer",
        dismiss: "Plus tard",
        confirmed: "Brouillon envoyé (dans la démo uniquement).",
        dismissed: "D'accord, rien n'a été envoyé.",
      },
    },
    {
      time: "21:58",
      when: "La veille au soir",
      query: "Je range le matériel, tu me confirmes la liste ?",
      connections: [
        { kind: "Rappel", text: "2 batteries chargées" },
        { kind: "Rappel", text: "2 cartes CF formatées" },
        { kind: "Mémoire", text: "Objectif 35mm f/1.4 pour la fosse" },
        { kind: "Note", text: "Lingettes + pare-soleil oubliés la dernière fois" },
      ],
      answer:
        "Batteries et cartes CF sont validées. Votre note du dernier shooting signale que vous aviez oublié lingettes et pare-soleil : ajoutez-les maintenant pour ne pas y penser demain sur place. L'objectif 35mm f/1.4 est bien le bon pour la fosse.",
      nextStep: {
        label: "Rappel intelligent",
        text: "Ajouter « lingettes + pare-soleil » à la liste de demain ?",
        confirm: "Ajouter",
        dismiss: "Inutile",
        confirmed: "Ajouté à votre liste (dans la démo uniquement).",
        dismissed: "D'accord, aucun rappel créé.",
      },
    },
    {
      time: "19:50",
      when: "Le soir du shooting",
      query: "Je suis en route, tu me rappelles quoi à l'arrivée ?",
      connections: [
        { kind: "Événement", text: "Retrait accréditation au nom du média" },
        { kind: "Note", text: "Fosse : 3 titres, puis côté scène" },
        { kind: "Rappel", text: "Partir 45 min avant, confirmé" },
        { kind: "Contact", text: "Claire V. sur place si souci" },
      ],
      answer:
        "À l'arrivée : retrait de l'accréditation au nom du média, puis directement en fosse pour les 3 premiers titres avant de basculer côté scène. Votre rappel « partir 45 min avant » est validé. Claire V. est votre contact sur place en cas de souci.",
      nextStep: {
        label: "Contexte disponible sur place",
        text: "Garder cette fiche ouverte pour le shooting ?",
        confirm: "Garder",
        dismiss: "Fermer",
        confirmed: "Fiche épinglée pour la soirée (dans la démo uniquement).",
        dismissed: "Fiche fermée.",
      },
    },
    {
      time: "09:30",
      when: "Le lendemain matin",
      query: "Qu'est-ce que j'ai capté hier dont je dois me souvenir ?",
      connections: [
        { kind: "Projet", text: "Série « Scène 2025 » : +38 photos" },
        { kind: "Note", text: "Côté scène : lumière chaude, cadrer large" },
        { kind: "Mémoire", text: "Claire V. veut un export avant vendredi" },
      ],
      answer:
        "Hier : 38 photos ajoutées à la série « Scène 2025 ». Votre note côté scène conseille une lumière chaude et des cadrages larges. Claire V. a demandé un export avant vendredi, à planifier dans la sélection.",
      nextStep: {
        label: "Suite logique",
        text: "Créer une tâche « sélection Scène 2025, export vendredi » ?",
        confirm: "Créer la tâche",
        dismiss: "Plus tard",
        confirmed: "Tâche créée (dans la démo uniquement).",
        dismissed: "D'accord, rien n'a été créé.",
      },
    },
  ],
  outro: "Même contexte, du premier réflexe du matin à la sélection du lendemain.",
} as const;

// --- Mini-démo publique ------------------------------------------

export const PUBLIC_DEMO = {
  title: "Posez votre question.",
  description:
    "La démonstration répond à partir d'un jeu de données fictives, comme l'application le ferait avec les vôtres.",
  disclaimer: "Démonstration limitée, données fictives. Aucun accès à votre espace personnel.",
  placeholder: "Ex. : Que dois-je préparer pour demain ?",
  button: "Demander",
  suggestions: [
    "Que dois-je préparer pour demain ?",
    "Retrouve les informations de mon prochain shooting.",
    "Quels événements importants arrivent bientôt ?",
  ],
  contextLabel: "Contexte mobilisé (fictif)",
  errors: {
    rate: "Trop de demandes, réessayez dans un instant.",
    generic: "La démonstration est momentanément indisponible. Réessayez.",
    invalid: "Question trop longue (400 caractères maximum).",
  },
  after: {
    title: "Ceci n'était qu'un aperçu.",
    text: "L'application complète est réservée aux personnes disposant déjà d'un accès.",
    loginCta: "Se connecter",
    githubCta: "Voir le code",
    note: "Les comptes publics sont en développement : voir la section « Comptes ».",
  },
} as const;

// --- Comptes et clés (chantier en cours) ---------------------------
// Annonce honnête du passage au multi-utilisateur : pas de promesse de
// disponibilité, capacité gratuite limitée, branche de développement nommée.

export const ROADMAP = {
  badge: "Chantier en cours",
  title: "Comptes, clés, espace personnel.",
  lead: "Backstage prépare son ouverture : chaque personne crée son compte, apporte ses propres clés et retrouve un espace isolé du reste. Le travail est en cours sur une branche dédiée, rien de tout cela n'est encore accessible.",
  facts: [
    {
      title: "Compte personnel",
      desc: "Inscription par passkey et code de secours. Un espace vide au départ, isolé de tous les autres comptes.",
    },
    {
      title: "Vos clés, votre coût",
      desc: "IA, Google, Microsoft, météo, recherche : vous branchez ce que vous voulez avec vos propres clés. Aucune clé partagée entre comptes.",
    },
    {
      title: "Gratuit et limité",
      desc: "L'accès restera gratuit pendant la phase de test, avec une capacité de 10 à 15 comptes. Ce n'est pas un service illimité.",
    },
    {
      title: "Simple d'abord",
      desc: "Un dossier de fichiers par compte, pas de base de données. Suffisant à cette échelle ; Postgres viendra seulement si nécessaire.",
    },
  ],
  status: {
    label: "Branche",
    value: "feat/multi-utilisateurs-byok",
  },
  roadmapCta: "Lire la roadmap",
  codeCta: "Voir le code",
  note: "Pas encore disponible : inscription ouverte, récupération de compte, quotas, facturation. La démo publique reste la seule entrée sans compte.",
} as const;

// --- Chez vous ---------------------------------------------------

export const SELF_HOST = {
  title: "Chez vous, en une commande.",
  lead: "Backstage tourne sur votre machine : un dossier de données, un conteneur, aucune dépendance à un service tiers pour exister.",
  facts: [
    {
      title: "Accès par passkey",
      desc: "Pas de mot de passe à retenir : l'entrée est biométrique, et toute route privée est protégée par défaut.",
    },
    {
      title: "Données locales",
      desc: "L'espace vit dans des fichiers JSON, chez vous, avec sauvegardes et écritures atomiques.",
    },
    {
      title: "Actions confirmées",
      desc: "Un mail envoyé, un agenda modifié : rien ne part sans une confirmation explicite.",
    },
    {
      title: "Licence MIT",
      desc: "Le code est public : lisez-le, auditez-le, déployez votre propre instance.",
    },
  ],
  terminalTitle: "Installation",
  terminalNote: "Node 22 et Docker · ou clonez le dépôt et lancez le guide d'auto-hébergement.",
  cta: "Guide d'auto-hébergement",
  codeCta: "Voir le code sur GitHub",
} as const;

// --- Photographies -------------------------------------------------
// Images du propriétaire (concerts), servies depuis /photos.

export const PHOTOS = {
  credit: "© Mattia Parrinello",
  afterHero: {
    src: "/photos/damso-marches.jpg",
    alt: "Noir et blanc : un chanteur assis seul sur des marches blanches, avant d'entrer en scène.",
    caption: "Damso, 15 mai 2026",
    position: "50% 72%",
  },
  afterStory: {
    src: "/photos/jokair-pagaille.jpg",
    alt: "Un chanteur en chemise rouge, détaché sur fond blanc, micro à la main.",
    caption: "Jok'air, Pagaille",
    position: "50% 30%",
  },
  afterMemory: {
    src: "/photos/concert-trebiz-2026.jpg",
    alt: "Le public d'un concert, visages levés dans une lumière rouge.",
    caption: "Trebiz, 20 février 2026",
    position: "50% 45%",
  },
  beforeClose: {
    src: "/photos/damso-faisceaux.jpg",
    alt: "Silhouette suspendue dans deux faisceaux bleus au-dessus de la scène.",
    caption: "Damso, 15 mai 2026",
  },
} as const;

// --- CTA final ---------------------------------------------------

export const FINAL_CTA = {
  title: "Et si votre journée formait enfin un tout ?",
  description:
    "L'aperçu public suffit pour voir comment Backstage relie une question à son contexte.",
  primaryCta: "Essayer la démo",
  secondaryCta: "Se connecter",
  tertiaryCta: "Voir le code",
  note: "Démonstration à données fictives · Comptes publics en préparation",
} as const;

// --- Footer ------------------------------------------------------

export const FOOTER = {
  tagline: "Un espace personnel qui comprend le contexte.",
  links: [
    { href: "#hero", label: "Produit" },
    { href: "#memoire", label: "Mémoire" },
    { href: "#journee", label: "Une journée" },
    { href: "#chez-vous", label: "Auto-hébergement" },
  ],
  legal: [
    { href: GITHUB_URL, label: "GitHub", external: true },
    { href: SELF_HOST_URL, label: "Documentation", external: true },
    { href: "/privacy", label: "Confidentialité", external: false },
    { href: "/login", label: "Se connecter", external: false },
  ],
  signature: "Licence MIT · Code source public · Développé avec OpenCode",
} as const;
