import type { ComponentType, FunctionComponent } from "react";

/**
 * Icone de rail declarative (ADR 0001, decision G).
 *
 * Le chrome est un composant client : il ne peut pas importer le registre, et
 * Next interdit de rendre un composant React dans une Route Handler. Le module
 * declare donc son trace une fois, et le noyau le sert en SVG statique.
 *
 * Le type reste `ComponentType` pour ne pas casser le contrat : un module qui
 * passe un composant client ordinaire (lucide) obtient le glyphe neutre, un
 * module qui utilise `railIcon()` obtient son icone.
 */
export type RailIcon = FunctionComponent<{ className?: string }> & {
  readonly railSvg: string;
};

const SVG_OPEN =
  '<svg class="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';

/** Construit une icone de rail a partir du contenu SVG interne. */
export function railIcon(inner: string): RailIcon {
  const railSvg = `${SVG_OPEN}${inner}</svg>`;

  function Icon({ className }: { className?: string }) {
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden
        dangerouslySetInnerHTML={{ __html: inner }}
      />
    );
  }

  return Object.assign(Icon, { railSvg });
}

/** SVG d'une icone de rail, ou `undefined` si le module n'en a pas fourni. */
export function railIconMarkup(icon: ComponentType<{ className?: string }>): string | undefined {
  const markup = (icon as Partial<RailIcon>).railSvg;
  return typeof markup === "string" && markup ? markup : undefined;
}

/** Glyphe neutre : entree de navigation visible meme sans icone exploitable. */
export const RAIL_FALLBACK_ICON =
  '<svg class="h-full w-full" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
  'stroke-width="1.6" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3" /></svg>';
