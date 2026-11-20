// ============================================================
// Une journee avec Backstage (scrollytelling), donnees fictives.
// ATTENTION : DONNEES DE DEMONSTRATION, entierement fictives.
// Le temps AVANCE d'une etape a l'autre : on suit une personne de
// 08:42 la veille du shooting jusqu'au lendemain matin.
// ============================================================

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
