// ============================================================
// Ce que la landing tient ensemble : les six domaines
// (version anglaise).
// ============================================================

export const MODULES = {
  title: "What it holds together.",
  lead: "Six domains, one space. Each block maps to a screen that already exists in the app.",
  items: [
    {
      name: "Mail",
      short: "Inbox summary",
      line: "Your Gmail inbox summarised in the conversation, without switching tabs.",
    },
    {
      name: "Calendar",
      short: "Classes, reminders",
      line: "One timeline, grouped by day, with a block for what is overdue.",
    },
    {
      name: "Memory",
      short: "Editable facts",
      line: "What the AI remembered, fact by fact: every line can be edited or deleted.",
    },
    {
      name: "Shoots",
      short: "Shoot → delivery",
      line: "Venues, accreditations, contacts and galleries, from shoot day to delivery.",
    },
    {
      name: "Code",
      short: "One problem a day",
      line: "A daily problem, with help that already knows your level and your goals.",
    },
    {
      name: "At home",
      short: "Local files",
      line: "Your data lives in a local folder. No account to create with a third party.",
    },
  ],
} as const;
