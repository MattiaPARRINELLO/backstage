import { describe, it, expect } from "vitest";
import { INVALID_CHAT_BODY_MESSAGE, parseChatBody } from "@/app/api/chat/request";

describe("parseChatBody", () => {
  it("accepte un corps valide et rend la charge utile typee", () => {
    const result = parseChatBody({
      messages: [
        { role: "user", content: "Bonjour" },
        { role: "assistant", content: "Salut" },
      ],
      model: "code",
      sessionId: "conv-42",
      actionContext: "action deja executee",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.messages).toHaveLength(2);
    expect(result.body.messages[0]?.content).toBe("Bonjour");
    expect(result.body.model).toBe("code");
    expect(result.body.sessionId).toBe("conv-42");
    expect(result.body.actionContext).toBe("action deja executee");
  });

  it("refuse une liste de messages vide avec le message exact", () => {
    const result = parseChatBody({ messages: [] });

    expect(result).toEqual({ ok: false, message: INVALID_CHAT_BODY_MESSAGE });
    expect(INVALID_CHAT_BODY_MESSAGE).toBe(
      "Corps de requête invalide : messages (tableau non vide avec role et content) requis."
    );
  });

  it("refuse un role inconnu", () => {
    const result = parseChatBody({
      messages: [{ role: "tool", content: "resultat" }],
    });

    expect(result).toEqual({ ok: false, message: INVALID_CHAT_BODY_MESSAGE });
  });

  it("accepte les champs optionnels absents", () => {
    const result = parseChatBody({
      messages: [{ role: "assistant" }],
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.messages[0]?.content).toBeUndefined();
    expect(result.body.model).toBeUndefined();
    expect(result.body.sessionId).toBeUndefined();
    expect(result.body.actionContext).toBeUndefined();
  });

  it("travaille sur une charge utile deja parsee et refuse une chaine brute", () => {
    const payload = JSON.parse('{"messages":[{"role":"user","content":"Bonjour"}]}');
    expect(parseChatBody(payload).ok).toBe(true);

    // La lecture de `request.json()` reste la responsabilite du handler.
    expect(parseChatBody('{"messages":[]}')).toEqual({
      ok: false,
      message: INVALID_CHAT_BODY_MESSAGE,
    });
  });

  it("conserve l'outil dans un message assistant et nettoie le sessionId", () => {
    const result = parseChatBody({
      messages: [
        {
          role: "assistant",
          toolCalls: [{ id: "tc-1", name: "web_search", arguments: '{"query":"test"}' }],
        },
      ],
      sessionId: "  conv-42  ",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.body.messages[0]?.toolCalls).toEqual([
      { id: "tc-1", name: "web_search", arguments: '{"query":"test"}' },
    ]);
    expect(result.body.sessionId).toBe("conv-42");
  });
});
