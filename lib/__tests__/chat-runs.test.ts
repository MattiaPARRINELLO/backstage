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
  it("accumule le texte et les outils dans l'instantané", () => {
    const run = createRun("run-contenu");

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
