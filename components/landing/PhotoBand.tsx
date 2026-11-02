import Image from "next/image";
import { PHOTOS } from "@/app/landing-content";
import { reveal } from "./reveal";

type PhotoBandProps = {
  src: string;
  alt: string;
  caption: string;
  /** Cadrage vertical du bandeau, ex. "50% 72%". */
  position?: string;
  priority?: boolean;
};

/**
 * Bandeau photo pleine largeur : une image de concert, sa légende,
 * et le crédit. C'est le seul endroit où la page respire autrement
 * que par la typographie.
 */
export function PhotoBand({ src, alt, caption, position, priority }: PhotoBandProps) {
  return (
    <section className="band" aria-label={caption}>
      <figure {...reveal(0)}>
        <div className="band__frame">
          <Image
            src={src}
            alt={alt}
            width={2800}
            height={1575}
            sizes="100vw"
            priority={priority}
            className="band__img"
            style={position ? { objectPosition: position } : undefined}
          />
        </div>
        <figcaption className="band__cap">
          <span>{caption}</span>
          <span>{PHOTOS.credit}</span>
        </figcaption>
      </figure>
    </section>
  );
}
