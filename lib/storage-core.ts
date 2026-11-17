/**
 * Shim de compatibilité du moteur de stockage.
 *
 * Le moteur vit dans `packages/module-kit` depuis la phase 2 de #84 : un module
 * distribué doit pouvoir persister ses données sans importer l'intérieur du
 * noyau. `lib/storage-core.ts` reste le nom d'import historique de
 * l'application ; il ne fait plus que ré-exporter.
 *
 * Le kit garde ce moteur hors de sa surface publique principale (sous-chemin
 * `@backstage/module-kit/storage-core`) : c'est une implémentation, pas un
 * contrat à stabiliser.
 */
export * from "@backstage/module-kit/storage-core";
