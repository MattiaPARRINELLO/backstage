// ============================================================
// Premier ecran et contexte relie (version anglaise).
// ============================================================

export const HERO = {
  title: "Your context, in one place.",
  description:
    "Backstage brings your email, notes, calendar, photos and an AI that remembers them together. A private space, installed at home.",
  primaryCta: "Try the demo",
  secondaryCta: "View the code",
  loginCta: "Sign in",
  note: "Public demo with fictional data · Public accounts in preparation",
} as const;

export const CONTEXT = {
  label: "Connected context",
  title: "One question. Four pieces come together.",
  lead: "Backstage does not search a single folder: it gathers what your calendar, inbox, notes and reminders already know, then answers.",
  question: "What do I need to prepare for tomorrow's shoot?",
  fragments: [
    { kind: "Calendar", text: "Shoot Thursday 8:30 pm, Le Transbordeur" },
    { kind: "Mail", text: "Claire V.: press accreditation under the media name, pick up on site" },
    { kind: "Note", text: "Pit: first 3 songs, then side stage" },
    { kind: "Reminder", text: "Charge batteries and CF cards tonight" },
  ],
  answer:
    "Thursday 8:30 pm at Le Transbordeur. The accreditation is under the media name, to be picked up on site; pit access for the first three songs, then side stage. Charge batteries and CF cards tonight.",
  foot: "Four pieces of your space merged into one answer · fictional example",
  sourcesCount: "4 sources",
} as const;
