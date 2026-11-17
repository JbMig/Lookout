import { describe, expect, it } from "vitest";
import { LoginInput, SignupInput } from "@/lib/schemas";

describe("formulaires de connexion", () => {
  it("accepte un mot de passe vide (mode démo, champ masqué)", () => {
    const r = SignupInput.parse({ email: "a@b.fr", password: "", fullName: "", orgName: "" });
    expect(r.password).toBeUndefined();
    expect(r.orgName).toBeUndefined();
  });
  it("conserve un mot de passe saisi, quelle que soit sa longueur", () => {
    expect(SignupInput.parse({ email: "a@b.fr", password: "motdepasse123" }).password).toBe("motdepasse123");
    expect(LoginInput.parse({ email: "a@b.fr", password: "x" }).password).toBe("x");
  });
  it("refuse un e-mail invalide", () => {
    expect(() => SignupInput.parse({ email: "pas-un-email" })).toThrow();
  });
});
