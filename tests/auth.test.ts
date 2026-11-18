import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined, set: () => null, delete: () => null, getAll: () => [] }) }));
import { LoginInput, SignupInput } from "@/lib/schemas";

describe("formulaires de connexion", () => {
  it("accepte un mot de passe vide (mode démo, champ masqué)", () => {
    const r = SignupInput.parse({ email: "a@b.fr", password: "", fullName: "" });
    expect(r.password).toBeUndefined();
    expect(r.fullName).toBeUndefined();
  });
  it("conserve un mot de passe saisi, quelle que soit sa longueur", () => {
    expect(SignupInput.parse({ email: "a@b.fr", password: "motdepasse123" }).password).toBe("motdepasse123");
    expect(LoginInput.parse({ email: "a@b.fr", password: "x" }).password).toBe("x");
  });
  it("refuse un e-mail invalide", () => {
    expect(() => SignupInput.parse({ email: "pas-un-email" })).toThrow();
  });
});

describe("cookie de démo", () => {
  it("relit l'identité complète et refuse un cookie invalide", async () => {
    const { readDemoCookie } = await import("../src/lib/auth");
    const raw = Buffer.from(JSON.stringify({ id: "u1", email: "demo@lookout.app", name: "Compte démo" })).toString("base64url");
    expect(readDemoCookie(raw)).toEqual({ id: "u1", email: "demo@lookout.app", name: "Compte démo" });
    expect(readDemoCookie("pas-du-json")).toBeNull();
    expect(readDemoCookie(undefined)).toBeNull();
  });
});
