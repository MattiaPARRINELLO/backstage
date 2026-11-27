import { describe, it, expect, beforeEach } from "vitest";
import { signJwt, verifyJwt, TOKEN_PURPOSE } from "@/lib/session-core";

// Configurer un secret pour les tests
process.env.AUTH_SECRET = "test-secret-thirtytwo-chars-long-for-hmac!!";

describe("session-core", () => {
  beforeEach(() => {
    process.env.AUTH_SECRET = "test-secret-thirtytwo-chars-long-for-hmac!!";
  });

  it("signe et vérifie un JWT valide", async () => {
    const payload = {
      sub: "user123",
      role: "admin",
      purpose: TOKEN_PURPOSE.session,
    };
    const token = await signJwt(payload);
    expect(token).toBeDefined();
    expect(token.split(".")).toHaveLength(3);

    const decoded = await verifyJwt<typeof payload>(token, TOKEN_PURPOSE.session);
    expect(decoded).not.toBeNull();
    expect(decoded!.sub).toBe("user123");
    expect(decoded!.role).toBe("admin");
  });

  it("signe un JWT avec expiration et la vérifie", async () => {
    const future = Math.floor(Date.now() / 1000) + 3600;
    const payload = { sub: "user123", purpose: TOKEN_PURPOSE.session, exp: future };
    const token = await signJwt(payload);
    const decoded = await verifyJwt<{ sub: string }>(token, TOKEN_PURPOSE.session);
    expect(decoded).not.toBeNull();
    expect(decoded!.sub).toBe("user123");
  });

  it("rejette un token expiré", async () => {
    const past = Math.floor(Date.now() / 1000) - 3600;
    const payload = {
      sub: "user123",
      purpose: TOKEN_PURPOSE.session,
      exp: past,
    };
    const token = await signJwt(payload);
    const decoded = await verifyJwt(token, TOKEN_PURPOSE.session);
    expect(decoded).toBeNull();
  });

  it("rejette un token invalide", async () => {
    const decoded = await verifyJwt("invalid.token.format", TOKEN_PURPOSE.session);
    expect(decoded).toBeNull();
  });

  it("rejette un token à 2 segments", async () => {
    const payload = { sub: "user123", purpose: TOKEN_PURPOSE.session };
    const token = await signJwt(payload);
    const [header, body] = token.split(".");
    expect(await verifyJwt(`${header}.${body}`, TOKEN_PURPOSE.session)).toBeNull();
  });

  it("rejette un token avec signature modifiée", async () => {
    const payload = { sub: "user123", purpose: TOKEN_PURPOSE.session };
    const token = await signJwt(payload);
    const parts = token.split(".");
    const tampered = parts[0] + "." + parts[1] + ".invalidsignature";
    const decoded = await verifyJwt(tampered, TOKEN_PURPOSE.session);
    expect(decoded).toBeNull();
  });

  it("rejette un token avec payload invalide", async () => {
    // payload "AAAA" décode en octets nuls → JSON.parse échoue → catch retourne null
    const decoded = await verifyJwt(
      "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.AAAA.dGVzdA",
      TOKEN_PURPOSE.session
    );
    expect(decoded).toBeNull();
  });

  it("rejette un token dont la signature est invalide pour HMAC", async () => {
    // crypto.subtle.verify lance pour une signature trop courte → catch retourne null
    const payload = { sub: "test", purpose: TOKEN_PURPOSE.session };
    const token = await signJwt(payload);
    const parts = token.split(".");
    // signature d'1 seul caractère = 1 octet → HMAC-SHA256 requiert 32 octets
    const shortSig = Buffer.from([0]).toString("base64url");
    const decoded = await verifyJwt(
      `${parts[0]}.${parts[1]}.${shortSig}`,
      TOKEN_PURPOSE.session
    );
    expect(decoded).toBeNull();
  });

  it("rejette un token de challenge vérifié comme session", async () => {
    const token = await signJwt({ challenge: "abc", purpose: TOKEN_PURPOSE.challenge });
    expect(await verifyJwt(token, TOKEN_PURPOSE.session)).toBeNull();
    expect(await verifyJwt(token, TOKEN_PURPOSE.challenge)).not.toBeNull();
  });

  it("rejette un token de session vérifié comme challenge", async () => {
    const token = await signJwt({ sub: "owner", purpose: TOKEN_PURPOSE.session });
    expect(await verifyJwt(token, TOKEN_PURPOSE.challenge)).toBeNull();
    expect(await verifyJwt(token, TOKEN_PURPOSE.session)).not.toBeNull();
  });

  it("rejette un token sans claim purpose", async () => {
    const token = await signJwt({ sub: "owner" });
    expect(await verifyJwt(token, TOKEN_PURPOSE.session)).toBeNull();
    expect(await verifyJwt(token, TOKEN_PURPOSE.challenge)).toBeNull();
  });

  it("utilise AUTH_SECRET depuis le fichier si variable d'env absente", async () => {
    const fs = await import("fs");
    const os = await import("os");
    const path = await import("path");
    const original = process.env.AUTH_SECRET;
    const originalCwd = process.cwd;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "backstage-auth-secret-"));

    try {
      delete process.env.AUTH_SECRET;
      // Le chemin est resolu a la lecture : le test n'ecrit jamais dans le
      // `data/` reel du depot (#302).
      process.cwd = () => tempDir;
      fs.mkdirSync(path.join(tempDir, "data"), { recursive: true });
      fs.writeFileSync(
        path.join(tempDir, "data", ".auth-secret"),
        Buffer.from("test-secret-thirtytwo-chars-long-for-hmac!!").toString("hex")
      );

      const mod = await import("@/lib/session-core");
      const token = await mod.signJwt({
        sub: "file-test",
        purpose: mod.TOKEN_PURPOSE.session,
      });
      expect(token.split(".")).toHaveLength(3);
      const decoded = await mod.verifyJwt<{ sub: string }>(
        token,
        mod.TOKEN_PURPOSE.session
      );
      expect(decoded?.sub).toBe("file-test");
    } finally {
      process.cwd = originalCwd;
      process.env.AUTH_SECRET = original;
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
