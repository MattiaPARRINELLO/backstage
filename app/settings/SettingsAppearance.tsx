import { Row, Section } from "./SettingsSection";
import { AccentPicker } from "@/components/ui/AccentPicker";

export function SettingsAppearance() {
  return (
    <Section
      title="Apparence"
      description="La couleur qui signale l'action et la donnée qui compte."
    >
      <Row label="Couleur d'accent" hint="Appliquée à toute l'interface.">
        <AccentPicker />
      </Row>
    </Section>
  );
}
