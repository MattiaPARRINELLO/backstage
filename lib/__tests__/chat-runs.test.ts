import { describe, expect, it, vi } from "vitest";
import {
  abortRun,
  createRun,
  finishRun,
  getRun,
  publish,
  snapshotOf,
  subscribe,
} from "@/lib/chat-runs";
import type { ChatTransportEvent } from "@/lib/chat-run-types";

function collect(sessionId: string) {
  const events: ChatTransportEvent[] = [];
  const unsubscribe = subscribe(getRun(sessionId)!, (event) => events.push(event), false);
  return { events, unsubscribe };
}

describe("chat-runs", () => {
  it("accumule le texte et les outils dans l'instantané", () => {    const run = createRun("run-contenu");

    publish(run, { type: "delta", content: "Bon" });
    publish(run, { type: "delta", content: "jour" });
    publish(run, {
      type: "tool_start",
      toolCallId: "t1",
      name: "get_schedule",
      arguments: "{}",
    });
    publish(run, {
      type: "tool_result",
      name: "get_schedule",
      result: "Cours A\nCours B",
      status: "ok",
    });

    const snapshot = snapshotOf(run);
    expect(snapshot.content).toBe("Bonjour");
    expect(snapshot.activeTools).toHaveLength(0);
    expect(snapshot.tools).toHaveLength(1);
    expect(snapshot.tools[0].status).toBe("success");
    expect(snapshot.tools[0].resultCount).toBe(2);
    expect(snapshot.finished).toBe(false);
  });

  it("marque un outil bloqué comme erreur", () => {
    const run = createRun("run-bloque");
    publish(run, {
      type: "tool_start",
      toolCallId: "t1",
      name: "send_email_response",
      arguments: "{}",
    });
    publish(run, {
      type: "tool_result",
      name: "send_email_response",
      result: "ACTION_BLOCKED",
      status: "blocked",
    });

    expect(snapshotOf(run).tools[0].status).toBe("error");
  });

  it("diffuse les évènements aux abonnés sans rejeu initial", () => {
    const run = createRun("run-diffusion");
    const { events } = collect("run-diffusion");

    publish(run, { type: "delta", content: "a" });

    expect(events).toEqual([{ type: "delta", content: "a" }]);
  });

  it("rejoue l'instantané puis done pour une génération terminée", () => {
    const run = createRun("run-fini");
    publish(run, { type: "delta", content: "Réponse" });
    publish(run, { type: "done", content: "Réponse" });
    finishRun(run, "Réponse");

    const events: ChatTransportEvent[] = [];
    subscribe(run, (event) => events.push(event), true);

    expect(events[0]).toMatchObject({
      type: "snapshot",
      content: "Réponse",
      finished: true,
      doneContent: "Réponse",
    });
    expect(events[1]).toEqual({ type: "done", content: "Réponse" });
  });

  it("termine le run dès l'évènement done, avant l'écriture disque", () => {
    const run = createRun("run-done-precoce");
    publish(run, { type: "delta", content: "ok" });
    publish(run, { type: "done", content: "ok" });

    expect(snapshotOf(run).finished).toBe(true);
  });

  it("construit le fil d'activité : pensées cumulées puis outils dans l'ordre", () => {
    const run = createRun("run-fil");
    publish(run, { type: "reasoning", content: "Je regarde" });
    publish(run, { type: "reasoning", content: " les salles." });
    publish(run, {
      type: "tool_start",
      toolCallId: "t1",
      name: "web_search",
      arguments: '{"query":"salles Paris"}',
    });
    publish(run, {
      type: "tool_result",
      name: "web_search",
      result: "La Cigale\nLe Trabendo",
      status: "ok",
    });
    publish(run, { type: "reasoning", content: "Je croise avec les rappels." });

    const steps = snapshotOf(run).steps;
    expect(steps).toHaveLength(3);
    expect(steps[0]).toEqual({ kind: "thought", text: "Je regarde les salles." });
    expect(steps[1]).toMatchObject({
      kind: "tool",
      name: "web_search",
      status: "success",
      resultCount: 2,
    });
    expect(steps[2]).toEqual({
      kind: "thought",
      text: "Je croise avec les rappels.",
    });
  });

  it("mesure la durée par outil, pas depuis le début du tour", () => {
    vi.useFakeTimers();
    try {
      const run = createRun("run-duree");
      publish(run, { type: "tool_start", toolCallId: "t1", name: "get_weather", arguments: "{}" });
      vi.advanceTimersByTime(400);
      publish(run, { type: "tool_result", name: "get_weather", result: "ok", status: "ok" });

      publish(run, { type: "tool_start", toolCallId: "t2", name: "get_schedule", arguments: "{}" });
      vi.advanceTimersByTime(2_000);
      publish(run, { type: "tool_result", name: "get_schedule", result: "ok", status: "ok" });

      const [first, second] = snapshotOf(run).steps;
      expect(first.kind).toBe("tool");
      expect(second.kind).toBe("tool");
      expect(first.kind === "tool" && first.duration).toBeCloseTo(0.4, 1);
      expect(second.kind === "tool" && second.duration).toBeCloseTo(2, 1);
    } finally {
      vi.useRealTimers();
    }
  });

  it("abandonne la génération précédente quand une nouvelle démarre", () => {
    const first = createRun("run-remplace");
    first.controller.signal.addEventListener("abort", () => {});
    expect(first.controller.signal.aborted).toBe(false);

    const second = createRun("run-remplace");

    expect(first.controller.signal.aborted).toBe(true);
    expect(first.aborted).toBe(true);
    expect(getRun("run-remplace")).toBe(second);
  });

  it("abortRun n'abandonne pas un run déjà terminé", () => {
    const run = createRun("run-termine");
    publish(run, { type: "done", content: "" });

    const spy = vi.fn();
    run.controller.signal.addEventListener("abort", spy);
    abortRun("run-termine");

    expect(run.aborted).toBe(false);
    expect(spy).not.toHaveBeenCalled();
  });
});
