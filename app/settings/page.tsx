"use client";

import Link from "next/link";

import { PasskeyPairing } from "./PasskeyPairing";
import { SettingsAppearance } from "./SettingsAppearance";
import { SettingsConnections } from "./SettingsConnections";
import { SettingsData } from "./SettingsData";
import { SettingsLeetcode } from "./SettingsLeetcode";
import { SettingsModels } from "./SettingsModels";
import { SettingsNotifications } from "./SettingsNotifications";
import { Row, Section } from "./SettingsSection";
import { SettingsSession } from "./SettingsSession";
import { useRuntimeInfo } from "./useRuntimeInfo";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/Chrome";

export default function SettingsPage() {
  const { runtime, models, setModels } = useRuntimeInfo();

  return (
    <AppShell>
      <div className="flex-1 min-w-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-2xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
          <PageHeader
            title="Paramètres"
            description="Personnalise ton interface et gère tes connexions."
          />

          <SettingsAppearance />

          <SettingsModels
            runtime={runtime}
            modelSel={models}
            setModelSel={setModels}
          />

          <SettingsConnections />

          <SettingsNotifications runtime={runtime} />

          <SettingsLeetcode />

          <Section
            title="Modules"
            description="Les capacités branchées sur BACKSTAGE : état réel du registre, activation, ajout et retrait."
          >
            <Row label="Gérer les modules" hint="Voir ce que le serveur sert, installer ou retirer un module.">
              <Link
                href="/settings/modules"
                className="ui-btn ui-btn--ghost ui-btn--sm px-4 text-[var(--t-small)]"
              >
                Ouvrir
              </Link>
            </Row>
          </Section>

          <Section
            title="Sécurité"
            description="Les clés qui ouvrent BACKSTAGE, et les appareils autorisés à en recevoir une."
          >
            <PasskeyPairing />
          </Section>

          <SettingsData />

          <SettingsSession />

          <p className="mt-12 text-[var(--t-small)] text-[var(--text-3)]">
            BACKSTAGE — version web
          </p>
        </div>
      </div>
    </AppShell>
  );
}
