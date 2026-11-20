// Focus mode actif : les notifications sont mises en silence. Les rappels et
// relances restent en attente et seront envoyes apres la fin de la session.
export async function isFocusActive(): Promise<boolean> {
  try {
    const { getFocusState } = await import("./focus");
    const state = await getFocusState();
    if (!state.active || !state.endsAt) return false;
    return new Date(state.endsAt).getTime() > Date.now();
  } catch {
    return false;
  }
}
