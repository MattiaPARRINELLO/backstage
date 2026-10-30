"use client";

import { Suspense, useEffect, useState, useCallback, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { startAuthentication, startRegistration } from "@simplewebauthn/browser";
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from "@simplewebauthn/browser";
import { Fingerprint, Loader2, ShieldCheck, AlertCircle, Check } from "lucide-react";

type Phase = "checking" | "idle" | "scanning" | "verified" | "error";

const RING_R = 95;

const PHASE_STATUS: Record<Phase, string> = {
  checking: "Vérification de la clé",
  idle: "Système prêt — touche l'empreinte",
  scanning: "Lecture en cours",
  verified: "Clé vérifiée — ouverture",
  error: "",
};

const PHASE_LIGHT: Record<Phase, string> = {
  checking: "var(--text-4)",
  idle: "var(--text-3)",
  scanning: "var(--accent)",
  verified: "var(--success)",
  error: "var(--danger)",
};

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const setupToken = searchParams?.get("setupToken") ?? "";

  const [status, setStatus] = useState<"idle" | "loading" | "registering" | "authenticating">("idle");
  const [needsRegistration, setNeedsRegistration] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verified, setVerified] = useState(false);
  const redirectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (redirectTimer.current) clearTimeout(redirectTimer.current);
    },
    []
  );

  useEffect(() => {
    void fetch("/api/auth/session", { credentials: "same-origin" })
      .then((res) => res.json() as Promise<{ authenticated: boolean }>)
      .then((data) => {
        if (data.authenticated) {
          router.replace("/chat");
          return;
        }
        return fetch("/api/auth/passkey/register-options", {
          credentials: "same-origin",
          headers: setupToken ? { "x-setup-token": setupToken } : undefined,
        })
          .then(async (res) => {
            const data = (await res.json()) as { isFirstRegistration?: boolean; error?: string };
            if (!res.ok || data.error) {
              // 401 = une passkey existe déjà mais la session est expirée :
              // on bascule sur le flux d'authentification (le bouton « Se connecter »).
              if (res.status === 401) {
                setNeedsRegistration(false);
                return;
              }
              setError(data.error ?? `Impossible de vérifier l'état de l'enregistrement (${res.status}).`);
              return;
            }
            setNeedsRegistration(data.isFirstRegistration ?? false);
          });
      })
      .catch(() => setNeedsRegistration(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const completeAuth = useCallback(() => {
    setVerified(true);
    redirectTimer.current = setTimeout(() => {
      router.replace("/chat");
    }, 900);
  }, [router]);

  async function handleRegister() {
    if (status !== "idle" || verified) return;

    setStatus("registering");
    setError(null);
    try {
      const optionsRes = await fetch("/api/auth/passkey/register-options", {
        credentials: "same-origin",
        headers: setupToken ? { "x-setup-token": setupToken } : undefined,
      });
      const optionsData = (await optionsRes.json()) as { options: PublicKeyCredentialCreationOptionsJSON };
      const attestation = await startRegistration({ optionsJSON: optionsData.options });
      const verifyRes = await fetch("/api/auth/passkey/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ response: attestation, setupToken: setupToken || undefined }),
      });
      const verifyData = (await verifyRes.json()) as { verified?: boolean; error?: string };
      if (verifyData.verified) {
        completeAuth();
      } else {
        setError(verifyData.error ?? "L'enregistrement a échoué.");
        setStatus("idle");
      }
    } catch {
      setError("Impossible d'enregistrer la clé. Utilise un appareil compatible Face ID / Touch ID.");
      setStatus("idle");
    }
  }

  async function handleAuthenticate() {
    if (status !== "idle" || verified) return;

    setStatus("authenticating");
    setError(null);
    try {
      const optionsRes = await fetch("/api/auth/passkey/auth-options", { credentials: "same-origin" });
      const optionsData = (await optionsRes.json()) as { options?: PublicKeyCredentialRequestOptionsJSON; error?: string };
      if (optionsData.error || !optionsData.options) {
        setError(optionsData.error ?? "Aucune clé enregistrée.");
        setStatus("idle");
        return;
      }
      const assertion = await startAuthentication({ optionsJSON: optionsData.options });
      const verifyRes = await fetch("/api/auth/passkey/auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ response: assertion }),
      });
      const verifyData = (await verifyRes.json()) as { verified?: boolean; error?: string };
      if (verifyData.verified) {
        completeAuth();
      } else {
        setError(verifyData.error ?? "L'authentification a échoué.");
        setStatus("idle");
      }
    } catch {
      setError("Authentification annulée ou impossible. Réessaie.");
      setStatus("idle");
    }
  }

  const phase: Phase = verified
    ? "verified"
    : status === "registering" || status === "authenticating"
      ? "scanning"
      : error
        ? "error"
        : needsRegistration === null
          ? "checking"
          : "idle";

  const isBusy = status !== "idle" || verified;
  const label = needsRegistration === null
    ? "Chargement…"
    : needsRegistration
      ? "Configurer Face ID / Touch ID"
      : "Se connecter avec Face ID / Touch ID";

  return (
    <div className="relative z-10 flex min-h-screen items-center justify-center px-4">
      <div className="login-load relative z-10 flex flex-col items-center w-full max-w-sm text-center">
        {/* En-tête */}
        <p className="text-[11px] font-mono text-[var(--text-3)]">Accès privé</p>
        <h1 className="mt-3 font-editorial text-[40px] leading-none text-[var(--text-1)]">
          BACKSTAGE
        </h1>
        <p className="mt-3 text-[13px] leading-relaxed text-[var(--text-3)]">
          Ton visage, ta clé. Aucun mot de passe à retenir.
        </p>

        {/* L'anneau biométrique — le seul moment lumineux de l'écran */}
        <div
          aria-hidden="true"
          data-phase={phase}
          className="login-ring relative mt-10 w-44 h-44 rounded-full transition-colors duration-200"
        >
          <svg viewBox="0 0 200 200" className="w-full h-full" aria-hidden>
            <circle
              cx="100"
              cy="100"
              r={RING_R}
              fill="none"
              strokeWidth="1"
              stroke="currentColor"
              opacity="0.14"
            />
            <circle
              cx="100"
              cy="100"
              r={RING_R}
              fill="none"
              strokeWidth="1.5"
              strokeLinecap="round"
              stroke="currentColor"
              className="login-progress-arc"
            />
          </svg>

          <span className="absolute inset-0 flex items-center justify-center">
            <span className="login-fingerprint">
              <Fingerprint className="w-11 h-11" strokeWidth={1.25} />
            </span>
            <span className="login-check">
              <Check className="w-10 h-10" strokeWidth={1.5} />
            </span>
          </span>
        </div>

        {/* Ligne de statut */}
        <div className="mt-8 min-h-[22px] flex items-center justify-center gap-2.5 px-4">
          <span
            className="w-1.5 h-1.5 shrink-0 rounded-full transition-colors duration-300"
            style={{ backgroundColor: PHASE_LIGHT[phase] }}
            aria-hidden
          />
          {phase === "error" ? (
            <span className="flex items-start gap-1.5 text-[12px] text-[var(--danger)] leading-relaxed max-w-[300px] text-left">
              <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </span>
          ) : (
            <span
              className={`text-[12px] ${
                phase === "scanning" || phase === "verified"
                  ? "text-[var(--accent)]"
                  : "text-[var(--text-3)]"
              }`}
            >
              {PHASE_STATUS[phase]}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => (needsRegistration ? handleRegister() : handleAuthenticate())}
          disabled={isBusy || needsRegistration === null}
          className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-6 text-[13px] font-medium text-[#17110a] transition-colors duration-150 hover:bg-[#ebb275] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-[var(--accent)]"
        >
          {isBusy && !verified ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              {label}
            </>
          ) : (
            label
          )}
        </button>

        <p className="mt-3 text-[11px] font-mono text-[var(--text-4)]">
          Face ID · Touch ID · Clé de sécurité
        </p>

        <p className="text-[11px] text-[var(--text-4)] mt-12 text-center">
          <ShieldCheck className="w-3.5 h-3.5 inline-block mr-1.5 -mt-0.5" />
          Clé d&apos;accès WebAuthn
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
