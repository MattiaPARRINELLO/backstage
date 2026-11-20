"use client";

import { useEffect, useState } from "react";
import { loadLeetcode, setLeetcodeUsername } from "@/app/actions/leetcode";
import { Row, Section } from "./SettingsSection";

export function SettingsLeetcode() {
  const [leetUsername, setLeetUsername] = useState("");
  const [leetSaving, setLeetSaving] = useState(false);
  const [leetMsg, setLeetMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    loadLeetcode().then((d) => {
      if (d.leetcodeUsername) setLeetUsername(d.leetcodeUsername);
    }).catch(() => {});
  }, []);

  const handleLeetSave = async () => {
    setLeetSaving(true);
    setLeetMsg(null);
    try {
      await setLeetcodeUsername(leetUsername);
      setLeetMsg({ ok: true, text: "Synchronisé avec LeetCode ✓" });
    } catch (e) {
      setLeetMsg({ ok: false, text: e instanceof Error ? e.message : "Erreur" });
    } finally {
      setLeetSaving(false);
    }
  };

  return (
    <Section
      title="LeetCode"
      description="Le pseudo qui alimente le suivi des exercices."
    >
      <Row label="Pseudo" hint="Synchronisé depuis ton profil public.">
        <div className="flex w-full items-center gap-2 sm:w-auto">
          <div className="ui-field h-10 w-full sm:w-44">
            <input
              type="text"
              value={leetUsername}
              onChange={(e) => setLeetUsername(e.target.value)}
              placeholder="ton-pseudo-leetcode"
              aria-label="Pseudo LeetCode"
              className="w-full min-w-0 bg-transparent text-[var(--t-small)] text-[var(--text-1)] outline-none placeholder:text-[var(--text-3)]"
            />
          </div>
          <button
            type="button"
            className="ui-btn ui-btn--ghost h-10 shrink-0 px-4 text-[var(--t-small)]"
            onClick={handleLeetSave}
            disabled={leetSaving || !leetUsername.trim()}
          >
            {leetSaving ? "…" : "Sauvegarder"}
          </button>
        </div>
      </Row>
      {leetMsg && (
        <div className="border-b border-[var(--line)] py-3">
          <p
            role="status"
            className="text-[var(--t-small)]"
            style={{ color: leetMsg.ok ? "var(--success)" : "var(--danger)" }}
          >
            {leetMsg.text}
          </p>
        </div>
      )}
    </Section>
  );
}
