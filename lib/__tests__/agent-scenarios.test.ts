/**
 * Scenarios dores de selection d'outils.
 *
 * Chaque scenario decrit une intention utilisateur et verifie la **decision**
 * attendue, au niveau qui peut etre teste hors ligne : le contrat des outils.
 *
 *   1. l'outil attendu existe dans le registre expose au modele ;
 *   2. ses arguments attendus respectent son schema (cles declarees, champs
 *      requis, types) ;
 *   3. les outils interdits ne sont pas celui qui est choisi ;
 *   4. une action a effet de bord est refusee sans confirmation ;
 *   5. un scenario en lecture seule ne peut declencher aucune ecriture.
 *
 * Le provider `mock` ne decide rien (il n'y a pas de modele) : il ne peut donc
 * pas prouver la qualite d'une decision. Ce que cette suite protege, c'est le
 * contrat qui casse en silence lors d'un renommage ou du passage du `switch` a
 * un registre (#84) : un outil renomme sans mettre a jour les scenarios fait
 * echouer la suite.
 *
 * Execution : `bun run test:agent` (aucun reseau, aucune cle).
 */

import { describe, expect, it } from "vitest";
import {
  ACTION_BLOCKED_PREFIX,
  executeTool,
  toolPolicy,
  tools,
} from "@/lib/chat-tools";
import { SIDE_EFFECT_TOOL_NAMES } from "@/lib/tool-result";

// Dérivés des déclarations, jamais d'une liste de noms tenue à la main : un
// outil qui devient une écriture entre dans ces scénarios sans édition.
const writeToolNames = tools
  .filter((tool) => toolPolicy(tool.name).write)
  .map((tool) => tool.name);

interface AgentScenario {
  /** Intention utilisateur, telle qu'elle serait tapee dans le chat. */
  intent: string;
  /** Outil attendu ; `null` pour une intention qui ne doit rien declencher. */
  expectedTool: string | null;
  /** Arguments attendus : valides contre le schema de l'outil. */
  expectArgs?: Record<string, unknown>;
  /** Outils qui ne doivent jamais etre choisis dans ce scenario. */
  forbidTools?: string[];
  /** L'outil attendu modifie des donnees. */
  writes?: boolean;
  /** L'outil attendu exige une confirmation explicite. */
  blockedWithoutConfirmation?: boolean;
  /** Lecture externe assumee (reseau autorise, aucune ecriture). */
  externalRead?: boolean;
}

const scenarios: AgentScenario[] = [
  {
    intent: "rappelle-moi d'appeler le CROUS demain a 9h",
    expectedTool: "reminders.add",
    expectArgs: { title: "Appeler le CROUS", due_at: "2026-11-17T09:00:00.000Z" },
    forbidTools: ["send_email_response", "calendar.delete"],
    writes: true,
  },
  {
    intent: "quels cours j'ai jeudi ?",
    expectedTool: "schedule.get",
    expectArgs: { scope: "week" },
    forbidTools: ["reminders.add", "send_email_response"],
  },
  {
    intent: "envoie un mail a la salle pour confirmer l'accreditation",
    expectedTool: "emails.reply",
    expectArgs: { email_id: "18c9f0", response_text: "Bonjour, je confirme ma presence." },
    forbidTools: ["reminders.add", "web.search"],
    writes: true,
    blockedWithoutConfirmation: true,
  },
  {
    intent: "cherche sur le web les prochaines dates de Muse a Paris",
    expectedTool: "web.search",
    expectArgs: { query: "Muse Paris 2027 dates" },
    forbidTools: ["send_email_response"],
  },
  {
    intent: "retiens que je prefere livrer les galeries en noir et blanc",
    expectedTool: "add_memory_fact",
    expectArgs: {
      content: "Preference : livrer les galeries en noir et blanc",
      category: "preference",
    },
    forbidTools: ["send_email_response"],
    writes: true,
  },
  {
    intent: "garde cet article pour plus tard",
    expectedTool: "watch-later.add",
    expectArgs: { url: "https://example.com/article", title: "Un article a garder" },
    forbidTools: ["send_email_response"],
    writes: true,
  },
  {
    intent: "quels sont mes rappels en attente ?",
    expectedTool: "reminders.list",
    expectArgs: {},
    forbidTools: ["reminders.add", "reminders.update", "send_email_response"],
  },
  {
    intent: "il fera quel temps a Paris samedi ?",
    expectedTool: "weather.get",
    expectArgs: { city: "Paris" },
    forbidTools: ["send_email_response"],
  },
  {
    intent: "prepare le concert de Muse au Zenith vendredi",
    expectedTool: "concerts.prepare",
    expectArgs: { concertId: "concert_42" },
    forbidTools: ["send_email_response"],
    externalRead: true,
  },
  {
    intent: "scanne mes accreditations photo en attente",
    expectedTool: "accreditations.scan",
    expectArgs: {},
    forbidTools: ["send_email_response"],
    writes: true,
  },
  {
    intent: "cree une issue GitHub pour ce bug de synchronisation",
    expectedTool: "github.create_issue",
    expectArgs: {
      title: "Synchronisation CESAR instable",
      body: "Contexte, comportement observe, comportement attendu, reproduction.",
    },
    forbidTools: ["send_email_response"],
    writes: true,
  },
  {
    intent: "liste mes shootings a venir",
    expectedTool: "photo.list",
    expectArgs: {},
    forbidTools: ["photo.add", "send_email_response"],
  },
  {
    intent: "bonjour, comment vas-tu ?",
    expectedTool: null,
    forbidTools: [...writeToolNames, "send_email_response", "emails.reply"],
  },
  {
    intent: "supprime l'evenement de demain dans mon agenda",
    expectedTool: "calendar.delete",
    expectArgs: { event_id: "evt_42" },
    forbidTools: ["send_email_response"],
    writes: true,
  },
];

interface JsonSchema {
  properties?: Record<string, { type?: string }>;
  required?: string[];
}

function findTool(name: string) {
  return tools.find((tool) => tool.name === name);
}

function assertArgumentsMatchSchema(
  toolName: string,
  args: Record<string, unknown>,
  schema: Record<string, unknown>
): void {
  const { properties = {}, required = [] } = schema as JsonSchema;

  for (const key of Object.keys(args)) {
    expect(
      propertyOrUndefined(properties, key),
      `${toolName} : argument inconnu "${key}"`
    ).toBeDefined();
  }

  for (const key of required) {
    expect(args, `${toolName} : argument requis "${key}" absent`).toHaveProperty(key);
  }

  for (const [key, value] of Object.entries(args)) {
    const type = propertyOrUndefined(properties, key)?.type;
    if (!type) continue;
    const actual = Array.isArray(value) ? "array" : typeof value;
    expect(actual, `${toolName}.${key} attend ${type}`).toBe(type);
  }
}

function propertyOrUndefined(
  properties: Record<string, { type?: string }>,
  key: string
): { type?: string } | undefined {
  return Object.prototype.hasOwnProperty.call(properties, key) ? properties[key] : undefined;
}

describe("registre d'outils", () => {
  it("expose les outils coeur attendus", () => {
    // Les noms coeur sont geeles : un renommage ou une suppression sans mise a
    // jour des scenarios fait echouer ici. Un module installe peut ajouter les
    // siens : la liste n'est donc pas une egalite stricte (#210).
    const names = tools.map((tool) => tool.name);
    for (const name of [
      "add_memory_fact",
      "photo.add",
      "reminders.add",
      "watch-later.add",
      "calendar.create",
      "github.create_issue",
      "calendar.delete",
      "emails.search",
      "web.page_meta",
      "schedule.get",
      "weather.get",
      "github.list_issues",
      "photo.list",
      "reminders.list",
      "concerts.list",
      "concerts.prepare",
      "accreditations.scan",
      "followups.schedule",
      "calendar.search",
      "emails.reply",
      "emails.triage",
      "calendar.update",
      "photo.update",
      "reminders.update",
      "web.search",
    ]) {
      expect(names, `outil "${name}" absent`).toContain(name);
    }
    expect(new Set(names).size, "un outil est declare deux fois").toBe(names.length);
  });

  it("declare un schema objet pour chaque outil", () => {
    for (const tool of tools) {
      expect(tool.parameters, tool.name).toMatchObject({ type: "object" });
      expect(tool.description.trim().length, tool.name).toBeGreaterThan(0);
    }
  });
});

describe("scenarios dores", () => {
  for (const scenario of scenarios) {
    it(scenario.intent, async () => {
      if (scenario.expectedTool === null) {
        // Intention conversationnelle : aucune ecriture ne doit etre possible.
        for (const forbidden of scenario.forbidTools ?? []) {
          const policy = toolPolicy(forbidden);
          expect(policy.write || policy.requiresConfirmation, forbidden).toBe(true);
        }
        expect(scenario.forbidTools).toEqual(
          expect.arrayContaining([...writeToolNames, "emails.reply"])
        );
        return;
      }

      const tool = findTool(scenario.expectedTool);
      expect(tool, `outil "${scenario.expectedTool}" absent du registre`).toBeDefined();

      for (const forbidden of scenario.forbidTools ?? []) {
        expect(forbidden, "un scenario ne peut pas cibler et interdire le meme outil").not.toBe(
          scenario.expectedTool
        );
        if (findTool(forbidden)) continue;
        expect(tool, `outil interdit "${forbidden}" inconnu du registre`).toBeDefined();
      }

      if (scenario.expectArgs) {
        assertArgumentsMatchSchema(scenario.expectedTool, scenario.expectArgs, tool!.parameters);
      }

      // Effet de bord : un scenario en lecture seule ne peut pas ecrire.
      if (!scenario.writes) {
        expect(toolPolicy(scenario.expectedTool).write).toBe(false);
        expect(toolPolicy(scenario.expectedTool).requiresConfirmation).toBe(false);
        if (!scenario.externalRead) {
          expect(SIDE_EFFECT_TOOL_NAMES.has(scenario.expectedTool)).toBe(false);
        }
      }

      if (scenario.blockedWithoutConfirmation) {
        expect(toolPolicy(scenario.expectedTool).requiresConfirmation).toBe(true);
        const result = await executeTool(scenario.expectedTool, scenario.expectArgs ?? {}, false);
        expect(result.startsWith(ACTION_BLOCKED_PREFIX)).toBe(true);
      }
    });
  }
});
