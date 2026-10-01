"use client";

import { MessageSquare, Send } from "lucide-react";
import { useEffect, useState } from "react";
import {
  testDiscordNotification,
  updateDiscordSettings,
  type DiscordStatus,
} from "@/app/actions/discord";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";

function Row({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 p-3 rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)]/40">
      <div>
        <p className="text-[13px] font-medium text-[var(--text-1)]">{title}</p>
        <p className="text-[11px] text-[var(--text-3)]">{subtitle}</p>
      </div>
      {children}
    </div>
  );
}

function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`w-9 h-5 rounded-full border transition-colors duration-200 shrink-0 ${
        checked
          ? "bg-[var(--accent)]/30 border-[var(--accent)]/60"
          : "bg-[var(--surface-3)] border-[var(--border-2)]"
      }`}
    >
      <span
        className={`block w-3.5 h-3.5 rounded-full transition-transform duration-200 ${
          checked ? "translate-x-[18px] bg-[var(--accent)]" : "translate-x-[3px] bg-[var(--text-3)]"
        }`}
      />
    </button>
  );
}

export function DiscordCard() {
  const [status, setStatus] = useState<DiscordStatus | null>(null);
  const [userId, setUserId] = useState("");
  const [events, setEvents] = useState(true);
  const [alerts, setAlerts] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    import("@/app/actions/discord")
      .then(({ loadDiscordStatus: load }) => load())
      .then((current) => {
        setStatus(current);
        setUserId(current.userId);
        setEvents(current.events);
        setAlerts(current.alerts);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg(null);
    try {
      const next = await updateDiscordSettings({ userId, events, alerts });
      setStatus(next);
      setMsg({ ok: true, text: "Réglages Discord enregistrés" });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Erreur" });
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    setMsg(null);
    try {
      const result = await testDiscordNotification();
      setMsg({ ok: result.sent, text: result.detail });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Erreur" });
    } finally {
      setTesting(false);
    }
  };

  const ready = status?.ready ?? false;

  return (
    <Card>
      <CardHeader
        title="Discord"
        subtitle="Messages privés du bot — embed + carte générée par l'app"
        action={<MessageSquare className="w-4 h-4 text-[var(--text-3)]" />}
      />
      <CardBody>
        <div className="space-y-3">
          <Row
            title={ready ? "Canal prêt" : "Canal incomplet"}
            subtitle={
              status === null
                ? "Vérification…"
                : !status.botConfigured
                  ? "DISCORD_BOT_TOKEN absent de l'environnement"
                  : !status.userId
                    ? "Identifiant utilisateur à renseigner"
                    : "Bot authentifié, destinataire renseigné"
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${ready ? "bg-[var(--accent)]" : "bg-[var(--text-3)]"}`}
            />
          </Row>

          <div className="space-y-2 p-3 rounded-lg border border-[var(--border-1)] bg-[var(--surface-2)]/40">
            <label className="text-[11px] uppercase tracking-wider text-[var(--text-3)] font-mono">
              identifiant utilisateur
            </label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value.trim())}
              placeholder="123456789012345678"
              inputMode="numeric"
            />
            <p className="text-[11px] text-[var(--text-3)]">
              Discord → Paramètres → Avancés → Mode développeur, puis clic droit sur ton profil →
              Copier l&apos;identifiant. Le bot doit partager un serveur avec toi.
            </p>
          </div>

          <Row
            title="Notifications d'événements"
            subtitle="Brief du jour, cours 30 min avant, rappels et relances en DM"
          >
            <Switch checked={events} onChange={setEvents} label="Notifications d'événements" />
          </Row>

          <Row
            title="Alertes techniques"
            subtitle="Erreurs serveur (sync CESAR, tokens expirés, scheduler) — plafonnées à 8 par heure"
          >
            <Switch checked={alerts} onChange={setAlerts} label="Alertes techniques" />
          </Row>

          <div className="flex items-center gap-2">
            <Button variant="primary" size="md" loading={saving} onClick={handleSave}>
              Enregistrer
            </Button>
            <Button
              variant="outline"
              size="md"
              loading={testing}
              leftIcon={<Send className="w-3.5 h-3.5" />}
              onClick={handleTest}
            >
              Envoyer un test
            </Button>
            {msg && (
              <span
                className={`text-[11px] ${msg.ok ? "text-[var(--accent)]" : "text-[var(--danger)]"}`}
              >
                {msg.text}
              </span>
            )}
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
