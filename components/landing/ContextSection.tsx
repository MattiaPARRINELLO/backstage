import { CONTEXT } from "@/app/landing-content";
import { reveal } from "./reveal";

/**
 * Le moment de la page : une question, les quatre morceaux qu'elle
 * mobilise, la réponse qu'ils composent. Les fragments arrivent l'un
 * après l'autre — c'est le seul mouvement de la section.
 */
export function ContextSection() {
  return (
    <section id="contexte" className="sec ctx">
      <div className="wrap">
        <div className="sec__head">
          <h2 className="h2" {...reveal(0)}>
            {CONTEXT.title}
          </h2>
          <p className="lead" {...reveal(70)}>
            {CONTEXT.lead}
          </p>
        </div>

        <div className="ctx__inner mt-12">
          <div className="ctx__ask" {...reveal(0)}>
            <p className="ctx__question">{CONTEXT.question}</p>
            <ul className="ctx__fragments">
              {CONTEXT.fragments.map((fragment, i) => (
                <li key={fragment.text} className="frag" {...reveal(80 + i * 70)}>
                  <span className="frag__kind">{fragment.kind}</span>
                  <span className="frag__text">{fragment.text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="ctx__answer" {...reveal(380)}>
            <p className="ctx__answer-text">{CONTEXT.answer}</p>
            <p className="ctx__foot">{CONTEXT.foot}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
