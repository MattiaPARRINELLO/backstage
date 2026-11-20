import { AndroidPairing } from "./AndroidPairing";
import { Row, Section } from "./SettingsSection";

export type NotificationsRuntime = {
  features: { dailyBrief: boolean };
  pushCount: number;
};

export function SettingsNotifications({
  runtime,
}: {
  runtime: NotificationsRuntime | null;
}) {
  return (
    <Section
      title="Notifications"
      description="Ce que l'appareil reçoit, et quand."
    >
      <Row
        label="Push"
        hint={
          runtime === null
            ? "Vérification…"
            : runtime.pushCount > 0
              ? `${runtime.pushCount} appareil(s) enregistré(s)`
              : "Aucun appareil enregistré"
        }
      />
      <Row
        label="Brief quotidien"
        hint={
          runtime === null
            ? "Vérification…"
            : runtime.features.dailyBrief
              ? "Activé — envoi à 7 h"
              : "Désactivé"
        }
      />
      <AndroidPairing />
    </Section>
  );
}
