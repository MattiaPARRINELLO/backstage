"use client";

import { api, type GoogleLinkStatus, type MicrosoftTodoStatus } from "@/lib/api-client";
import { useCachedFetch } from "@/lib/cache";
import { Row, Section } from "./SettingsSection";

const GOOGLE_STATUS_KEY = "google:status";

async function fetchGoogleStatus(): Promise<GoogleLinkStatus> {
  return api.googleStatus();
}

async function fetchMicrosoftStatus(): Promise<MicrosoftTodoStatus> {
  return api.microsoftStatus();
}

export function SettingsConnections() {
  const { data: status, loading } = useCachedFetch<GoogleLinkStatus>(
    GOOGLE_STATUS_KEY,
    fetchGoogleStatus,
    { ttl: 60 * 1000 }
  );

  const { data: msStatus, loading: msLoading } = useCachedFetch<MicrosoftTodoStatus>(
    "microsoft:status",
    fetchMicrosoftStatus,
    { ttl: 60 * 1000 }
  );

  const googleLabel = loading && !status
    ? "Vérification…"
    : status?.gmail
      ? "Connecté"
      : "Non connecté";

  return (
    <Section
      title="Connexions"
      description="Les comptes qui alimentent le calendrier, les mails et les rappels."
    >
      <Row label="Gmail" hint={googleLabel}>
        <a
          href="/api/auth/google?type=gmail"
          className="ui-btn ui-btn--ghost h-9 px-4 text-[var(--t-small)]"
        >
          {status?.gmail ? "Reconnecter" : "Connecter"}
        </a>
      </Row>

      <Row
        label="Calendrier"
        hint={loading && !status ? "Vérification…" : status?.calendar ? "Connecté" : "Non connecté"}
      >
        <a
          href="/api/auth/google?type=calendar"
          className="ui-btn ui-btn--ghost h-9 px-4 text-[var(--t-small)]"
        >
          {status?.calendar ? "Reconnecter" : "Connecter"}
        </a>
      </Row>

      <Row
        label="Microsoft To Do"
        hint={
          msLoading && !msStatus
            ? "Vérification…"
            : msStatus?.linked
              ? "Connecté — tes reminders Samsung se synchronisent ici."
              : "Non connecté — connecte ton compte pour lire tes reminders dans Rappels."
        }
      >
        <a
          href="/api/auth/microsoft"
          className="ui-btn ui-btn--ghost h-9 px-4 text-[var(--t-small)]"
        >
          {msStatus?.linked ? "Reconnecter" : "Connecter"}
        </a>
      </Row>
    </Section>
  );
}
