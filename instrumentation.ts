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

    // Le serveur standalone de Next tourne dans `.next/standalone` : sans ce
    // chemin explicite, toutes les donnees atterriraient dans le build et un
    // rebuild les effacerait. `scripts/start.ts` pose DATA_DIR sur la racine.
    const { getConfig } = await import("./lib/config");
    const { setDataDir } = await import("@backstage/module-kit/storage-core");
    setDataDir(getConfig().DATA_DIR ?? null);

    const { registry } = await import("./lib/kernel/registry");
    const { startScheduler } = await import("./lib/notification-scheduler");
    startScheduler(registry.jobs);

    // Repare en arriere-plan une configuration dont un modele a disparu du
    // catalogue. Ne bloque pas le demarrage : si le provider repond, le
    // premier tour de chat et le brief du matin partent deja avec un modele
    // vivant, sans repasser par les reglages.
    void import("./lib/app-config")
      .then(({ healConfiguredModels }) => healConfiguredModels())
      .catch((err) => console.warn("[config] Reparation des modeles impossible", err));
  }
}
