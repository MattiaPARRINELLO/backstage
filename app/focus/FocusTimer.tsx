"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { startFocusSession, stopFocusSession } from "@/app/actions/focus";
import type { FocusState } from "@/lib/focus";

const DEFAULT_MIN = 25;

const DURATIONS = [
  { min: 15, label: "15 min" },
  { min: 25, label: "25 min" },
  { min: 45, label: "45 min" },
  { min: 90, label: "90 min" },
];

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Le chiffre dominant de l'ecran : mono, tabulaire, un seul par vue. */
function BigFigure({ children }: { children: React.ReactNode }) {
  return (
    <p className="ui-mono text-[length:var(--t-display)] font-normal leading-[0.95] tracking-[-0.04em] tabular-nums text-[var(--text-1)]">
      {children}
    </p>
  );
}

export function FocusTimer({ initialState }: { initialState: FocusState }) {
  const [state, setState] = useState<FocusState>(initialState);
  const [remaining, setRemaining] = useState<number | null>(null);
  const endedNotified = useRef(false);

  // Session active : tick toutes les secondes pour le décompte.
  useEffect(() => {
    if (!state.active || !state.endsAt) return;
    const endsAt = new Date(state.endsAt).getTime();
    const tick = () => {
      const left = endsAt - Date.now();
      setRemaining(left);
      if (left <= 0 && !endedNotified.current) {
        endedNotified.current = true;
        // Nettoyage côté serveur une fois la session terminée.
        stopFocusSession()
          .then((next) => {
            setState(next);
            setRemaining(null);
          })
          .catch(() => {});
      }
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [state.active, state.endsAt]);

  const handleStart = async (min: number) => {
    try {
      setState(await startFocusSession(min));
      setRemaining(min * 60_000);
      endedNotified.current = false;
    } catch {
      // Session expirée ou erreur : l'UI reste sur l'état courant.
    }
  };

  const handleStop = async () => {
    try {
      setState(await stopFocusSession());
      setRemaining(null);
    } catch {
      // Ignoré.
    }
  };

  if (state.active && state.endsAt && (remaining === null || remaining > 0)) {
    const durationMs = (state.durationMin ?? 0) * 60_000;
    const progress =
      durationMs > 0 ? Math.min(1, Math.max(0, (remaining ?? 0) / durationMs)) : 0;

    return (
      <div className="flex flex-col items-start py-8">
        <BigFigure>{formatRemaining(remaining ?? 0)}</BigFigure>
        <p className="ui-mono mt-3 text-[var(--text-2)]">
          {state.durationMin} min
        </p>

        {/* Jauge plate : un filet de fond, un aplat d'accent qui se retire. */}
        <div
          className="mt-8 h-[3px] w-full overflow-hidden rounded-full bg-[var(--surface-3)]"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label="Temps restant"
        >
          <div
            className="h-full bg-[var(--accent)] transition-[width] duration-1000 ease-linear"
            style={{ width: `${progress * 100}%` }}
          />
        </div>

        <p className="ui-mono mt-8 text-[var(--text-2)]">Notifications coupées</p>

        <button
          onClick={() => void handleStop()}
          className="ui-btn ui-btn--ghost mt-6 hover:border-[var(--danger)] hover:text-[var(--danger)]"
        >
          <Square className="h-4 w-4" strokeWidth={1.6} />
          Terminer la session
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-start py-8">
      <BigFigure>{formatRemaining(DEFAULT_MIN * 60_000)}</BigFigure>
      <h2 className="font-display mt-8 text-[length:var(--t-lead)] font-semibold tracking-[-0.02em] text-[var(--text-1)]">
        Une session de focus ?
      </h2>
      <p className="mt-2 max-w-[34rem] text-[length:var(--t-body)] leading-relaxed text-[var(--text-2)]">
        Pendant la session, les notifications de rappels et de relances sont
        coupées. Elles partiront après — rien n&apos;est perdu.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {DURATIONS.map((d) => (
          <button
            key={d.min}
            onClick={() => void handleStart(d.min)}
            className="ui-chip transition-colors duration-150 hover:border-[var(--line-2)] hover:text-[var(--text-1)]"
          >
            {d.label}
          </button>
        ))}
      </div>
      <button
        onClick={() => void handleStart(DEFAULT_MIN)}
        className="ui-btn ui-btn--primary mt-8"
      >
        <Play className="h-4 w-4" strokeWidth={1.6} />
        Démarrer {DEFAULT_MIN} min
      </button>
    </div>
  );
}
