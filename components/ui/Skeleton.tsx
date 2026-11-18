"use client";

/**
 * Re-export : l'implementation vit dans le kit de modules, pour qu'une page de
 * module puisse l'utiliser sans importer le noyau (ADR 0001, decision G).
 */
export { Skeleton, SkeletonLines } from "@backstage/module-kit";
