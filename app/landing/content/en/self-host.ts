// ============================================================
// Section auto-hebergement : faits et bloc terminal
// (version anglaise).
// ============================================================

export const SELF_HOST = {
  title: "At home, in one command.",
  lead: "Backstage runs on your machine: a data folder, one container, no dependency on a third-party service to exist.",
  facts: [
    {
      title: "Passkey access",
      desc: "No password to remember: entry is biometric, and every private route is protected by default.",
    },
    {
      title: "Local data",
      desc: "Your space lives in JSON files, at home, with backups and atomic writes.",
    },
    {
      title: "Confirmed actions",
      desc: "An email sent, a calendar changed: nothing goes out without explicit confirmation.",
    },
    {
      title: "MIT licence",
      desc: "The code is public: read it, audit it, deploy your own instance.",
    },
  ],
  terminalTitle: "Installation",
  terminalNote: "Node 22 and Docker · or clone the repository and follow the self-hosting guide.",
  cta: "Self-hosting guide",
  codeCta: "View the code on GitHub",
} as const;
