import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    exclude: ["node_modules", ".next", ".mimocode", "e2e", "**/e2e/**", "docs/modules/modele"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcovonly", "json-summary"],
      reportsDirectory: "coverage",
      // Perimetre applicatif uniquement : les scripts, les configs et les tests
      // n'ont pas a tirer le chiffre vers le bas ni a le gonfler artificiellement.
      include: [
        "lib/**/*.{ts,tsx}",
        "modules/**/*.{ts,tsx}",
        "packages/**/*.{ts,tsx}",
        "app/api/**/*.{ts,tsx}",
        "app/actions/**/*.{ts,tsx}",
      ],
      exclude: ["**/__tests__/**", "**/*.test.{ts,tsx}", "**/*.d.ts"],
      // Planchers mesures le 25 novembre 2026, sur le perimetre logique
      // (lib, modules, kit, routes API et Server Actions). L'interface est
      // couverte par les E2E, pas par ces tests unitaires.
      // Ils ne peuvent que monter : les baisser pour faire passer une PR est un
      // aveu de regression.
      thresholds: {
        statements: 67,
        branches: 58,
        functions: 69,
        lines: 69,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
