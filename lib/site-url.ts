/**
 * URL publique canonique de l'instance, sans slash final.
 *
 * Source unique de vérité pour toutes les URL absolues du site (métadonnées,
 * commande d'installation affichée sur la landing). La valeur est inlinée au
 * build côté client : la changer demande un rebuild.
 *
 * Le repli est le domaine de production actuel, jamais `localhost` : une
 * instance déployée sans `NEXT_PUBLIC_SITE_URL` garde des URL valides.
 */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://backstage.mprnl.fr").replace(
  /\/$/,
  ""
);
