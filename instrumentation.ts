// dotenv est chargé dynamiquement dans le runtime node UNIQUEMENT : en import
// statique, il embarque fs/path/os/crypto dans le bundle edge de
// l'instrumentation, ce qui fait crasher le middleware edge
// ("__import_unsupported is not defined").
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("dotenv/config");

    // Verification non bloquante : un avertissement clair au demarrage vaut
    // mieux qu'une erreur au premier appel IA ou a la premiere connexion.
    const { checkDevEnv } = await import("./lib/env-check");
    const problems = checkDevEnv();
    if (problems.length > 0) {
      console.warn(
        `[env] Configuration incomplete (${problems.length} probleme(s)) :\n` +
          problems.map((problem) => `  - ${problem}`).join("\n")
      );
    }

    const { startScheduler } = await import("./lib/notification-scheduler");
    startScheduler();
  }
}
