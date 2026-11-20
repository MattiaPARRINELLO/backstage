// ============================================================
// Mini-demo publique et messages d'erreur associes
// (version anglaise).
// ============================================================

export const PUBLIC_DEMO = {
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
} as const;
