import { expect, it } from "vitest";
import { runHoleProbe } from "../scripts/probe-mutant-holes.ts";

it("rejects a stale vitest report when vitest does not run", () => {
  const result = runHoleProbe("stale");
  const output = `${result.stdout}\n${result.stderr}`;
  expect(result.status).toBe(1);
  expect(output).toContain("M1 killed");
  expect(output).toContain("M6 error");
  expect(output).not.toMatch(/^M6 killed/m);
});

it("rejects an empty mutant list", () => {
  const result = runHoleProbe("empty");
  const output = `${result.stdout}\n${result.stderr}`;
  expect(result.status).toBe(1);
  expect(output).toContain("scripts/mutants.json is empty");
  expect(output).not.toContain("killed");
});

it("rejects a mutant list that drops M6", () => {
  const result = runHoleProbe("missing-m6");
  const output = `${result.stdout}\n${result.stderr}`;
  expect(result.status).toBe(1);
  expect(output).toContain("scripts/mutants.json is missing M6");
  expect(output).not.toContain("killed");
});
