"use client";

import { useState } from "react";
import { DAY_STORY } from "@/app/landing-content";

const BEATS = DAY_STORY.beats;

type Outcome = "confirm" | "dismiss";

/**
 * Une journée, cinq heures : une frise verticale, l'heure en mono et
 * le contexte qui se relie. Le titre reste collé à gauche pendant
 * qu'on lit.
 */
export function DayStory() {
  const [outcomes, setOutcomes] = useState<Record<number, Outcome>>({});

  return (
    <section id="journee" className="sec sec--roomy">
      <div className="wrap story">
        <div className="story__head">
          <h2 className="h2 mt-5">
            {DAY_STORY.title}
          </h2>
          <p className="lead mt-4">
            {DAY_STORY.lead}
          </p>
          <p className="small mt-3">{DAY_STORY.disclaimer}</p>
          <p className="lead story__outro">{DAY_STORY.outro}</p>
        </div>

        <div className="story__list">
          {BEATS.map((beat, i) => {
            const outcome = outcomes[i];
            return (
              <article key={beat.time} className="beat">
                <div>
                  <p className="beat__time">{beat.time}</p>
                  <p className="beat__when">{beat.when}</p>
                </div>

                <div>
                  <p className="beat__query">« {beat.query} »</p>

                  <div className="beat__conns">
                    {beat.connections.map((connection) => (
                      <span key={connection.text} className="chip">
                        <b>{connection.kind}</b>
                        {connection.text}
                      </span>
                    ))}
                  </div>

                  <p className="beat__answer">{beat.answer}</p>

                  <div className="beat__next">
                    {outcome ? (
                      <p className="beat__outcome" role="status">
                        {outcome === "confirm"
                          ? beat.nextStep.confirmed
                          : beat.nextStep.dismissed}
                      </p>
                    ) : (
                      <>
                        <span className="small" style={{ flexBasis: "100%" }}>
                          {beat.nextStep.text}
                        </span>
                        <button
                          type="button"
                          className="beat__confirm"
                          onClick={() => setOutcomes((o) => ({ ...o, [i]: "confirm" }))}
                        >
                          {beat.nextStep.confirm}
                        </button>
                        <button
                          type="button"
                          className="beat__dismiss"
                          onClick={() => setOutcomes((o) => ({ ...o, [i]: "dismiss" }))}
                        >
                          {beat.nextStep.dismiss}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}
