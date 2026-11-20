// ============================================================
// Comptes et cles (chantier en cours), version anglaise.
// Annonce honnete du passage au multi-utilisateur : pas de promesse
// de disponibilite, capacite gratuite limitee, branche de
// developpement nommee.
// ============================================================

export const ROADMAP = {
  badge: "Work in progress",
  title: "Accounts, keys, your own space.",
  lead: "Backstage is preparing to open up: a shared core (chat, memory, reminders, calendar, mail), modules each person enables as needed, and their own API keys. The work is in progress on a dedicated branch; none of this is available yet.",
  facts: [
    {
      title: "Your own account",
      desc: "Sign up with a passkey and a recovery code. An empty space from day one, isolated from every other account.",
    },
    {
      title: "Your keys, your cost",
      desc: "AI, Google, Microsoft, weather, search: you plug in what you want with your own keys. No key shared between accounts.",
    },
    {
      title: "Core and modules",
      desc: "The core is the same for everyone. Photos, concerts, LeetCode and other modules are enabled case by case, on request and based on feedback.",
    },
    {
      title: "Free and limited",
      desc: "Access stays free during the test phase, with room for 10 to 15 accounts. This is not an unlimited service.",
    },
  ],
  status: {
    label: "Branch",
    value: "feat/multi-utilisateurs-byok",
  },
  roadmapCta: "Read the roadmap",
  codeCta: "View the code",
  note: "Not available yet: open signups, account recovery, quotas, billing. The public demo is still the only entry point without an account. The app itself is in French for now.",
} as const;
