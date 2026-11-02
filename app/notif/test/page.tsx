"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PageHeader } from "@/components/layout/Chrome";
import { useToast } from "@/components/ui/Toast";

interface SubInfo {
  count: number;
  endpoints: string[];
}

export default function NotifTestPage() {
  const { show: toast } = useToast();
  const [subs, setSubs] = useState<SubInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [browserPerm, setBrowserPerm] = useState<string>("...");

  useEffect(() => {
    queueMicrotask(() => {
      setBrowserPerm(typeof Notification !== "undefined" ? Notification.permission : "unsupported");
    });
    fetchSubs();
  }, []);

  async function fetchSubs() {
    try {
      const res = await fetch("/api/push");
      const data = (await res.json()) as SubInfo;
      setSubs(data);
    } catch {
      setSubs(null);
    }
  }

  async function sendTest() {
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/push", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: "Test BACKSTAGE", message: "Notification de test depuis la page debug" }),
      });
      const data = (await res.json()) as { sent: number; failed: number; count: number };
      setResult(`Envoyé à ${data.sent}/${data.count} appareil(s), ${data.failed} échec(s)`);
      toast({ message: `Test envoyé à ${data.sent} appareil(s)` });
    } catch {
      setResult("Erreur réseau");
    }
    setLoading(false);
  }

  async function testBrowserNotif() {
    if (!("Notification" in window)) {
      setResult("Notifications navigateur non supportées");
      return;
    }
    if (Notification.permission !== "granted") {
      const perm = await Notification.requestPermission();
      setBrowserPerm(perm);
      if (perm !== "granted") {
        setResult("Permission refusée");
        return;
      }
    }
    new Notification("Test navigateur", {
      body: "Ceci est une notification directe du navigateur",
      icon: "/icons/icon-192.png",
    });
    setResult("Notification navigateur affichée");
    setBrowserPerm(Notification.permission);
  }

  async function clearAll() {
    if (!confirm("Supprimer TOUTES les souscriptions push ?")) return;
    setLoading(true);
    try {
      const res = await fetch("/api/push", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true }),
      });
      const data = (await res.json()) as { cleared?: string; error?: string };
      toast({ message: data.cleared ? `Supprimé : ${data.cleared}` : "Erreur" });
      await fetchSubs();
    } catch {
      toast({ message: "Erreur réseau" });
    }
    setLoading(false);
  }

  return (
    <AppShell>
      <div className="mx-auto w-full max-w-2xl px-5 pb-24 pt-10 sm:px-8 sm:pt-14">
        <PageHeader
          title="Test notifications"
          description="Console de vérification du canal push de cet appareil."
        />

        <section className="mt-12">
          <h2 className="font-display text-[length:var(--t-lead)] font-semibold tracking-[-0.025em] text-[var(--text-1)]">
            Permission navigateur
          </h2>
          <div className="mt-4 border-t border-[var(--line)]">
            <div className="flex items-center justify-between gap-6 border-b border-[var(--line)] py-4">
              <p className="text-[length:var(--t-body)] text-[var(--text-1)]">Statut</p>
              <p
                className="ui-mono"
                style={{
                  color:
                    browserPerm === "granted"
                      ? "var(--success)"
                      : browserPerm === "denied"
                        ? "var(--danger)"
                        : "var(--text-2)",
                }}
              >
                {browserPerm}
              </p>
            </div>
            <div className="border-b border-[var(--line)] py-4">
              <button
                type="button"
                onClick={testBrowserNotif}
                className="ui-btn ui-btn--ghost h-10 px-5 text-[var(--t-small)]"
              >
                Tester notification navigateur
              </button>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-[length:var(--t-lead)] font-semibold tracking-[-0.025em] text-[var(--text-1)]">
            Souscriptions push
          </h2>
          <div className="mt-4 border-t border-[var(--line)]">
            <div className="flex items-center justify-between gap-6 border-b border-[var(--line)] py-4">
              <p className="text-[length:var(--t-body)] text-[var(--text-1)]">Appareils</p>
              <p className="ui-mono text-[var(--text-2)]">
                {subs ? `${subs.count} enregistré(s)` : "Chargement…"}
              </p>
            </div>
            {subs && subs.endpoints.length > 0 && (
              <ul className="border-b border-[var(--line)] py-3">
                {subs.endpoints.map((ep, i) => (
                  <li key={i} className="ui-mono break-all py-0.5 text-[var(--text-3)]">{ep}</li>
                ))}
              </ul>
            )}
            <div className="flex flex-wrap gap-2 border-b border-[var(--line)] py-4">
              <button
                type="button"
                onClick={fetchSubs}
                className="ui-btn ui-btn--ghost h-10 px-5 text-[var(--t-small)]"
              >
                Rafraîchir
              </button>
              <button
                type="button"
                onClick={sendTest}
                disabled={loading || !subs || subs.count === 0}
                className="ui-btn ui-btn--primary h-10 px-5 text-[var(--t-small)]"
              >
                {loading ? "Envoi…" : "Envoyer un push de test"}
              </button>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <h2 className="font-display text-[length:var(--t-lead)] font-semibold tracking-[-0.025em] text-[var(--danger)]">
            Zone sensible
          </h2>
          <div className="mt-4 border-t border-[var(--line)]">
            <div className="flex flex-col gap-3 border-b border-[var(--line)] py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
              <div className="min-w-0">
                <p className="text-[length:var(--t-body)] text-[var(--text-1)]">Supprimer les souscriptions</p>
                <p className="mt-1 text-[var(--t-small)] text-[var(--text-3)]">
                  Toutes les souscriptions push seront effacées.
                </p>
              </div>
              <button
                type="button"
                onClick={clearAll}
                disabled={loading}
                className="ui-btn ui-btn--ghost h-9 shrink-0 px-4 text-[var(--t-small)]"
                style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
              >
                {loading ? "Suppression…" : "Tout supprimer"}
              </button>
            </div>
          </div>
        </section>

        {result && (
          <p className="mt-8 text-[var(--t-small)] text-[var(--text-2)]" role="status">
            {result}
          </p>
        )}
      </div>
    </AppShell>
  );
}
