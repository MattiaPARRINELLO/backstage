import Image from "next/image";

type PhotoBandProps = {
  src: string;
  alt: string;
  caption: string;
  /** Cadrage vertical du bandeau, ex. "50% 72%". */
  position?: string;
  priority?: boolean;
  credit: string;
};

/**
 * Bandeau photo pleine largeur : une image de concert, sa légende,
 * et le crédit. C'est le seul endroit où la page respire autrement
 * que par la typographie.
 */
export function PhotoBand({ src, alt, caption, position, priority, credit }: PhotoBandProps) {
  return (
    <section className="band" aria-label={caption}>
      <figure>
        <div className="band__frame" data-parallax>
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
          <span>{credit}</span>
        </figcaption>
      </figure>
    </section>
  );
}
