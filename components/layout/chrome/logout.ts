// ============================================================
// Deconnexion : session détruite, puis caches prives purges.
// ============================================================

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
  // Purge des caches prives : cache du service worker (pages pre-rendues et
  // reponses GET mises en cache) + cache localStorage des API. Sans cette
  // purge, des donnees personnelles restent lisibles apres deconnexion.
  const registration = await navigator.serviceWorker?.getRegistration();
  registration?.active?.postMessage({ type: "CLEAR_CACHE" });
  const { clearOfflineCache } = await import("@/lib/offline");
  clearOfflineCache();
}
