// ============================================================
// Une journee avec Backstage (scrollytelling), donnees fictives.
// ATTENTION : DONNEES DE DEMONSTRATION, entierement fictives.
// Le temps AVANCE d'une etape a l'autre : on suit une personne de
// 08:42 la veille du shooting jusqu'au lendemain matin.
// ============================================================

export const DAY_STORY = {
  title: "Five times, the same context.",
  lead: "From the day before to the next morning: every hour finds what has already been said.",
  disclaimer: "Illustrative example, fictional data.",
  beats: [
    {
      time: "08:42",
      when: "The day before the shoot",
      query: "What do I need to prepare for tomorrow's shoot?",
      connections: [
        { kind: "Event", text: "Shoot: Le Transbordeur, Thursday 8:30 pm" },
        { kind: "Email", text: "Claire V.: “Accreditation under the media name, pick up on site”" },
        { kind: "Note", text: "Pit access for the first 3 songs, then side stage" },
        { kind: "Reminder", text: "Charge batteries + 2 CF cards the night before" },
      ],
      answer:
        "Your shoot is Thursday at 8:30 pm at Le Transbordeur. The accreditation is under the media name, to be picked up on site (email from Claire V.); in the pit: first 3 songs, then side stage. Remember to charge batteries and CF cards tonight.",
      nextStep: {
        label: "Suggested next step",
        text: "Add a reminder “leave 45 min early” for Thursday?",
        confirm: "Add the reminder",
        dismiss: "Not needed",
        confirmed: "Reminder added to your list (demo only).",
        dismissed: "Fine, no action taken.",
      },
    },
    {
      time: "12:15",
      when: "Lunch break",
      query: "I have a window at noon, where do I start?",
      connections: [
        { kind: "Reminder", text: "Confirm the accreditation with Claire V." },
        { kind: "Email", text: "Draft written yesterday, ready to send" },
        { kind: "Memory", text: "Preference: answer press officers in the morning" },
      ],
      answer:
        "Start with the accreditation: a reply draft to Claire V. is already waiting in your email. Your notes say you answer press officers in the morning, perfect for this window. Gear can wait until tonight.",
      nextStep: {
        label: "Suggested action",
        text: "Send the reply draft to Claire V.?",
        confirm: "Send",
        dismiss: "Later",
        confirmed: "Draft sent (demo only).",
        dismissed: "Fine, nothing was sent.",
      },
    },
    {
      time: "21:58",
      when: "The night before",
      query: "I'm packing the gear, can you confirm the list?",
      connections: [
        { kind: "Reminder", text: "2 charged batteries" },
        { kind: "Reminder", text: "2 formatted CF cards" },
        { kind: "Memory", text: "35mm f/1.4 lens for the pit" },
        { kind: "Note", text: "Wipes + lens hood forgotten last time" },
      ],
      answer:
        "Batteries and CF cards are checked. Your note from the last shoot says you forgot wipes and the lens hood: add them now so you don't think about it tomorrow on site. The 35mm f/1.4 is indeed the right lens for the pit.",
      nextStep: {
        label: "Smart reminder",
        text: "Add “wipes + lens hood” to tomorrow's list?",
        confirm: "Add",
        dismiss: "Not needed",
        confirmed: "Added to your list (demo only).",
        dismissed: "Fine, no reminder created.",
      },
    },
    {
      time: "19:50",
      when: "The evening of the shoot",
      query: "I'm on my way, what should I remember on arrival?",
      connections: [
        { kind: "Event", text: "Accreditation pickup under the media name" },
        { kind: "Note", text: "Pit: 3 songs, then side stage" },
        { kind: "Reminder", text: "Leave 45 min early, confirmed" },
        { kind: "Contact", text: "Claire V. on site if anything goes wrong" },
      ],
      answer:
        "On arrival: pick up the accreditation under the media name, then straight to the pit for the first 3 songs before moving to side stage. Your “leave 45 min early” reminder is confirmed. Claire V. is your on-site contact if anything goes wrong.",
      nextStep: {
        label: "Context available on site",
        text: "Keep this card open for the shoot?",
        confirm: "Keep",
        dismiss: "Close",
        confirmed: "Card pinned for the evening (demo only).",
        dismissed: "Card closed.",
      },
    },
    {
      time: "09:30",
      when: "The next morning",
      query: "What did I capture yesterday that I should remember?",
      connections: [
        { kind: "Project", text: "Series “Stage 2025”: +38 photos" },
        { kind: "Note", text: "Side stage: warm light, frame wide" },
        { kind: "Memory", text: "Claire V. wants an export before Friday" },
      ],
      answer:
        "Yesterday: 38 photos added to the series “Stage 2025”. Your side-stage note recommends warm light and wide framing. Claire V. asked for an export before Friday, to plan in the selection.",
      nextStep: {
        label: "Logical next step",
        text: "Create a task “Stage 2025 selection, Friday export”?",
        confirm: "Create the task",
        dismiss: "Later",
        confirmed: "Task created (demo only).",
        dismissed: "Fine, nothing was created.",
      },
    },
  ],
  outro: "Same context, from the first reflex of the morning to the selection the next day.",
} as const;
