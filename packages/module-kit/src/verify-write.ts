/**
 * Vérification par relecture après une écriture.
 *
 * Sans elle, un échec silencieux du stockage est renvoyé au modèle comme un
 * succès (« rappel créé ») alors que rien n'a été enregistré. Le module relit
 * ce qu'il vient d'écrire et le noyau transforme l'absence en erreur visible.
 */
export async function verifyWrite(
  label: string,
  present: () => Promise<boolean>
): Promise<string | null> {
  try {
    if (await present()) return null;
    return `Erreur : ecriture non confirmee : ${label} est introuvable apres enregistrement (verification par relecture).`;
  } catch (error) {
    return `Erreur : verification impossible pour ${label} (${error instanceof Error ? error.message : String(error)}).`;
  }
}
