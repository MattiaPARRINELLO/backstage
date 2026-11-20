import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Seul `lib/config.ts` lit `process.env` : il valide, normalise et borne
    // l'acces. Ailleurs, importer `getConfig()` (lib/config.ts) pour que toutes
    // les variables requises restent visibles dans un seul fichier.
    // Allowlist, et pourquoi chacune :
    //   - lib/config.ts          le lecteur unique
    //   - instrumentation.ts     `NEXT_RUNTIME` decide du runtime, avant config
    //   - next.config.ts         configuration du build, hors runtime applicatif
    //   - playwright.config.ts   orchestration des tests E2E
    //   - scripts/**             outils lancés hors Next (setup, crons, CI)
    //   - e2e/**                 tests de bout en bout
    //   - **/__tests__/**        stubs d'environnement des tests unitaires
    //   - components/ui/PwaLoader.tsx : Next n'inline `NEXT_PUBLIC_*` que sur un
    //     acces membre direct dans un bundle client, pas via un module partage.
    files: ["**/*.{ts,tsx,js,mjs,cjs}"],
    ignores: [
      "lib/config.ts",
      "instrumentation.ts",
      "next.config.ts",
      "playwright.config.ts",
      "scripts/**",
      "e2e/**",
      "**/__tests__/**",
      "components/ui/PwaLoader.tsx",
    ],
    rules: {
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Lire process.env uniquement dans lib/config.ts. Ailleurs : import { getConfig } from '@/lib/config'.",
        },
      ],
    },
  },
  {
    // Tout appel sortant vers un service externe passe par `lib/http.ts`
    // (timeout, retry borne, Zod, log). dependency-cruiser ne voit que les
    // imports, pas les globales : la regle vit donc dans ESLint.
    // Exceptions, et pourquoi :
    //   - lib/http.ts            le port lui-meme
    //   - lib/http-double.ts     double de test du port
    //   - lib/api-client.ts      client navigateur vers notre propre /api
    //   - app/**                 composants client, appels same-origin
    //   - scripts/**             outils hors Next (cron vers notre propre route)
    //   - tests                  doubles et stubs
    files: ["lib/**/*.{ts,tsx}", "modules/**/*.{ts,tsx}", "app/api/**/*.{ts,tsx}"],
    ignores: [
      "lib/http.ts",
      "lib/http-double.ts",
      "lib/api-client.ts",
      "**/__tests__/**",
      "**/*.test.ts",
    ],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message:
            "Appeler un service externe uniquement via lib/http.ts (timeout, retry, validation, log).",
        },
      ],
      "no-restricted-properties": [
        "error",
        {
          object: "globalThis",
          property: "fetch",
          message:
            "Appeler un service externe uniquement via lib/http.ts (timeout, retry, validation, log).",
        },
      ],
    },
  },
  {
    rules: {
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "coverage/**",
  ]),
]);

export default eslintConfig;
