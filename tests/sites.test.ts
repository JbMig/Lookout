import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import path from "path";

vi.mock("server-only", () => ({}));

// Base locale du mode démo, dans un dossier temporaire.
const dir = mkdtempSync(path.join(tmpdir(), "lookout-sites-"));
const cwd = process.cwd();
beforeAll(() => {
  for (const k of ["SUPABASE_URL", "SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) delete process.env[k];
  process.chdir(dir);
});
afterAll(() => {
  process.chdir(cwd);
  rmSync(dir, { recursive: true, force: true });
});

describe("sites", () => {
  it("ajoute un site rencontré pendant une analyse, une seule fois", async () => {
    const { ensureSite, listSites, recordSuccess, siteByDomain } = await import("../src/lib/sites");
    expect((await listSites()).length).toBe(8);

    const added = await ensureSite("www.marionnaud.fr", "EU");
    expect(added).toMatchObject({ domain: "marionnaud.fr", source: "discovered", method: "untested", country: "France" });
    await ensureSite("marionnaud.fr", "EU");
    expect((await listSites()).filter((s) => s.domain === "marionnaud.fr")).toHaveLength(1);

    // Un sous-domaine d'un site connu n'est pas un nouveau site.
    expect((await ensureSite("www.sephora.fr", "EU"))?.source).toBe("catalog");
    expect(await ensureSite(null, "EU")).toBeNull();

    await recordSuccess("marionnaud.fr", "scraping");
    const site = await siteByDomain("marionnaud.fr");
    expect(site?.method).toBe("scraping");
    expect(site?.lastSuccessAt).not.toBeNull();
  });
});
