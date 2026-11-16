// dotenv est chargé dynamiquement dans le runtime node UNIQUEMENT : en import
// statique, il embarque fs/path/os/crypto dans le bundle edge de
// l'instrumentation, ce qui fait crasher le middleware edge
// ("__import_unsupported is not defined"). Meme regle pour lib/config, qui
// reste sans fs mais dont la lecture doit rester paresseuse.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("dotenv/config");

    // Verification au demarrage : un probleme bloquant arrete le processus avec
    // un message actionnable (jamais une stack Zod), un probleme partiel
    // laisse l'application demarrer mais la signale.
    const { getStartupReport } = await import("./lib/config");
    const { fatal, warnings } = getStartupReport();

    if (fatal.length > 0) {
      console.error(
        `[config] Demarrage impossible (${fatal.length} probleme(s)) :\n` +
          fatal.map((problem) => `  - ${problem}`).join("\n") +
          "\nCorriger .env.local (modele : .env.example) puis redemarrer."
      );
      process.exit(1);
    }

    if (warnings.length > 0) {
      console.warn(
        `[config] Configuration incomplete (${warnings.length} probleme(s)) :\n` +
          warnings.map((problem) => `  - ${problem}`).join("\n")
      );
    }

    const { startScheduler } = await import("./lib/notification-scheduler");
    startScheduler();
  }
}
