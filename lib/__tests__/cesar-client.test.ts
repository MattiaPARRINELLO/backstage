import { describe, it, expect, vi } from "vitest";

// Le client CESAR importe le logger, qui depend du runtime Next.
vi.mock("next/headers", () => ({ headers: async () => new Map() }));

import {
  _extractSessionSelect,
  currentAcademicYear,
  pickSession,
} from "@/lib/cesar-client";

const formHtml = `
<form name="training_session_select" method="post" action="/session/update">
  <select id="training_session_select_sessions" name="training_session_select[sessions]">
    <option value="2026-2027">2026-2027</option>
    <option value="2025-2026" selected="selected">2025-2026</option>
  </select>
  <input type="hidden" id="training_session_select__token" name="training_session_select[_token]" value="jeton" />
</form>`;

describe("currentAcademicYear", () => {
  it("bascule sur l'annee suivante en septembre", () => {
    expect(currentAcademicYear(new Date(2026, 8, 1))).toBe("2026-2027");
  });

  it("garde l'annee precedente jusqu'en aout", () => {
    expect(currentAcademicYear(new Date(2026, 6, 15))).toBe("2025-2026");
  });
});

describe("pickSession", () => {
  it("choisit l'annee academique courante quand elle existe", () => {
    expect(pickSession(["2026-2027", "2025-2026"], new Date(2026, 10, 16))).toBe("2026-2027");
  });

  it("retombe sur la session la plus recente si l'annee courante manque", () => {
    expect(pickSession(["2025-2026", "2024-2025"], new Date(2026, 10, 16))).toBe("2025-2026");
  });

  it("retourne null sans option", () => {
    expect(pickSession([])).toBeNull();
  });
});

describe("_extractSessionSelect", () => {
  it("lit les options, la selection et le jeton CSRF", () => {
    expect(_extractSessionSelect(formHtml)).toEqual({
      selected: "2025-2026",
      options: ["2026-2027", "2025-2026"],
      token: "jeton",
    });
  });

  it("retourne null quand le select est absent", () => {
    expect(_extractSessionSelect("<html></html>")).toBeNull();
  });
});
