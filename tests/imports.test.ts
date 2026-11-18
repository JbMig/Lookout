import { describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { periodToDate } from "../src/lib/imports";

describe("periodToDate", () => {
  it("convertit les formats de période Circana en date", () => {
    expect(periodToDate("2026-Q3")).toBe("2026-07-01");
    expect(periodToDate("Q1 2025")).toBe("2025-01-01");
    expect(periodToDate("2026-07")).toBe("2026-07-01");
    expect(periodToDate("07/2026")).toBe("2026-07-01");
    expect(periodToDate("2026-03-15")).toBe("2026-03-15");
    expect(periodToDate("2024")).toBe("2024-01-01");
  });
  it("retombe sur la date fournie si la période est absente ou illisible", () => {
    const d = new Date("2026-11-17T00:00:00Z");
    expect(periodToDate(undefined, d)).toBe("2026-11-17");
    expect(periodToDate("n'importe quoi", d)).toBe("2026-11-17");
  });
});

describe("score des opportunités", () => {
  it("reste entre 0 et 1 (colonne numeric(4,3))", async () => {
    const { opportunityScore } = await import("../src/lib/pipeline");
    expect(opportunityScore(-18, 50)).toBe(0.36);
    expect(opportunityScore(250, 50)).toBe(1);
    expect(opportunityScore(-3.8, 10)).toBe(0.38);
  });
});
