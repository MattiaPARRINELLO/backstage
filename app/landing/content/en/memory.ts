// ============================================================
// Section memoire : faits retenus et principes (version anglaise).
// ============================================================

export const MEMORY = {
  factsLabel: "Memory · 3 facts",
  facts: [
    { kind: "Contact", text: "Claire V., press officer, accreditations" },
    { kind: "Preference", text: "Prefers bright light in the pit" },
    { kind: "Project", text: "Series “Stage 2025”, delivery in progress" },
  ],
  title: "It remembers. You can check.",
  lead: "A conversation no longer stops at its last line. Useful facts are written down, deduplicated, then reviewed: what is remembered stays visible and fixable.",
  principles: [
    {
      title: "Remember",
      desc: "Preferences, decisions, contacts: the durable pieces survive the conversation that gave birth to them.",
    },
    {
      title: "Connect",
      desc: "A fact about a person, a date or a project joins the others. A question about an event finds what relates to it.",
    },
    {
      title: "Stay in control",
      desc: "Memory is not a black box: it can be read, edited and deleted from the interface.",
    },
  ],
  editable: "editable",
} as const;
