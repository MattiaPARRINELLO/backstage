"use client";

// ============================================================
// Chrome de l'application : rail desktop, barre mobile haute,
// navigation basse mobile et bouton de fermeture.
//
// Ce fichier est le point d'entree public : l'implementation est
// repartie dans `components/layout/chrome/`. Il reexporte aussi les
// primitives de page servies par le kit de modules.
// ============================================================

export { LeftNav } from "./chrome/left-nav";
export { MobileTopBar } from "./chrome/mobile-top-bar";
export { MobileBottomNav } from "./chrome/mobile-bottom-nav";
export { CloseButton } from "./chrome/close-button";

export { PageHeader, EmptyState } from "@backstage/module-kit";
