import { LogOut } from "lucide-react";
import { Row, Section } from "./SettingsSection";

export function SettingsSession() {
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
      window.location.replace("/login");
    } catch (err) {
      console.error("Logout error", err);
    }
  };

  return (
    <Section title="Session">
      <Row label="Déconnexion" hint="Ferme ta session sur cet appareil.">
        <button
          type="button"
          className="ui-btn ui-btn--ghost h-9 px-4 text-[var(--t-small)]"
          onClick={handleLogout}
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden />
          Déconnexion
        </button>
      </Row>
    </Section>
  );
}
