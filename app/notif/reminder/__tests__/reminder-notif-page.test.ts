import { describe, it, expect, beforeEach, vi } from "vitest";

// getSession et le stockage sont mockés : on teste uniquement la garde
// d'accès de la page, pas les données réelles.
const mockGetSession = vi.fn();
vi.mock("@/lib/session", () => ({ getSession: mockGetSession }));

const mockGetReminders = vi.fn();
vi.mock("@/lib/storage", () => ({ getReminders: mockGetReminders }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    const err = new Error("NEXT_REDIRECT") as Error & { digest?: string };
    err.digest = `NEXT_REDIRECT;replace;${url};307;`;
    throw err;
  }),
  notFound: vi.fn(() => {
    const err = new Error("NEXT_NOT_FOUND") as Error & { digest?: string };
    err.digest = "NEXT_NOT_FOUND";
    throw err;
  }),
}));

const { default: ReminderNotifPage } = await import(
  "@/app/notif/reminder/[id]/page"
);

function render(id: string) {
  return ReminderNotifPage({ params: Promise.resolve({ id }) });
}

describe("Page /notif/reminder/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirige vers /login sans session, avant toute lecture du stockage", async () => {
    mockGetSession.mockResolvedValue(null);

    await expect(render("r1")).rejects.toMatchObject({
      digest: expect.stringContaining("/login"),
    });
    expect(mockGetReminders).not.toHaveBeenCalled();
  });

  it("affiche le rappel avec une session", async () => {
    mockGetSession.mockResolvedValue({ userId: "owner" });
    mockGetReminders.mockResolvedValue({
      reminders: [
        {
          id: "r1",
          title: "Rappel privé",
          notes: "Note confidentielle",
          dueAt: new Date(Date.now() + 3600_000).toISOString(),
          status: "pending",
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ],
    });

    const element = await render("r1");
    const { renderToStaticMarkup } = await import("react-dom/server");
    const html = renderToStaticMarkup(element);

    expect(html).toContain("Rappel privé");
    expect(html).toContain("Note confidentielle");
  });
});
