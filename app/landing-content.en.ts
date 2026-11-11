import type { LandingContent } from "./landing-content";

// ============================================================
// ENGLISH LANDING CONTENT
// Mirror of FR_CONTENT. The demo context and the product copy stay
// fictional; the app itself is still French for now, which the
// roadmap section states plainly.
// ============================================================

const GITHUB_URL = "https://github.com/MattiaPARRINELLO/backstage";
const ROADMAP_URL =
  "https://github.com/MattiaPARRINELLO/backstage/blob/feat/multi-utilisateurs-byok/docs/roadmap-multi-utilisateurs.md";
const SELF_HOST_URL =
  "https://github.com/MattiaPARRINELLO/backstage/blob/main/docs/self-hosting.md";

export const EN_CONTENT: LandingContent = {
  locale: "en",
  switchHref: "/",
  switchLabel: "FR",
  githubUrl: GITHUB_URL,
  selfHostUrl: SELF_HOST_URL,
  roadmapUrl: ROADMAP_URL,
  installCommand: "curl -fsSL https://backstage.mprnl.fr/install.sh | bash",
  nav: [
    { href: "#hero", label: "Product" },
    { href: "#memoire", label: "Memory" },
    { href: "#journee", label: "A day" },
    { href: "#demo", label: "Demo" },
    { href: "#comptes", label: "Accounts" },
    { href: "#chez-vous", label: "Self-hosting" },
  ],
  hero: {
    title: "Your context, in one place.",
    description:
      "Backstage brings your email, notes, calendar, photos and an AI that remembers them together. A private space, installed at home.",
    primaryCta: "Try the demo",
    secondaryCta: "View the code",
    loginCta: "Sign in",
    note: "Public demo with fictional data · Public accounts in preparation",
  },
  context: {
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
  },
  modules: {
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
  },
  memory: {
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
  },
  dayStory: {
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
  },
  publicDemo: {
    title: "Ask your question.",
    description:
      "The demo answers from a set of fictional data, the way the app would with yours.",
    disclaimer: "Limited demo, fictional data. No access to your personal space.",
    placeholder: "E.g.: What should I prepare for tomorrow?",
    button: "Ask",
    suggestions: [
      "What should I prepare for tomorrow?",
      "Find the details of my next shoot.",
      "Which important events are coming up?",
    ],
    contextLabel: "Mobilised context (fictional)",
    inputLabel: "Your question for the demo",
    loading: "Answering",
    errors: {
      rate: "Too many requests, try again in a moment.",
      generic: "The demo is temporarily unavailable. Try again.",
      invalid: "Question too long (400 characters maximum).",
    },
    after: {
      title: "That was only a preview.",
      text: "The full app is reserved for people who already have access.",
      loginCta: "Sign in",
      githubCta: "View the code",
      note: "Public accounts are in development: see the “Accounts” section.",
    },
  },
  roadmap: {
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
  },
  selfHost: {
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
  },
  photos: {
    credit: "© Mattia Parrinello",
    afterHero: {
      src: "/photos/damso-marches.jpg",
      alt: "Black and white: a singer sitting alone on white steps before going on stage.",
      caption: "Damso, 15 May 2026",
      position: "50% 72%",
    },
    afterStory: {
      src: "/photos/jokair-pagaille.jpg",
      alt: "A singer in a red shirt, cut out against a white background, microphone in hand.",
      caption: "Jok'air, Pagaille",
      position: "50% 30%",
    },
    afterMemory: {
      src: "/photos/concert-trebiz-2026.jpg",
      alt: "A concert crowd, faces raised in red light.",
      caption: "Trebiz, 20 February 2026",
      position: "50% 45%",
    },
    beforeClose: {
      src: "/photos/damso-faisceaux.jpg",
      alt: "A silhouette suspended in two blue beams above the stage.",
      caption: "Damso, 15 May 2026",
    },
  },
  finalCta: {
    title: "What if your day finally formed a whole?",
    description:
      "The public preview is enough to see how Backstage connects a question to its context.",
    primaryCta: "Try the demo",
    secondaryCta: "Sign in",
    tertiaryCta: "View the code",
    note: "Demo with fictional data · Public accounts in preparation",
  },
  footer: {
    tagline: "A personal space that understands context.",
    links: [
      { href: "#hero", label: "Product" },
      { href: "#memoire", label: "Memory" },
      { href: "#journee", label: "A day" },
      { href: "#chez-vous", label: "Self-hosting" },
    ],
    legal: [
      { href: GITHUB_URL, label: "GitHub", external: true },
      { href: SELF_HOST_URL, label: "Documentation", external: true },
      { href: "/privacy", label: "Privacy", external: false },
      { href: "/login", label: "Sign in", external: false },
    ],
    signature: "MIT licence · Public source code · Built with OpenCode",
  },
  ui: {
    navLabel: "Main navigation",
    mobileNavLabel: "Mobile navigation",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    footerLinksLabel: "Footer links",
    copyCommand: "Copy the install command",
    commandCopied: "Command copied",
    copy: "Copy",
    copied: "Copied",
    localData: "Local data",
  },
};
