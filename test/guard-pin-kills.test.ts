import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { describeScan, scanJsonValue } from "../scripts/check-dist.ts";
import { runGuardPinCheck } from "../scripts/check-guard-pins.ts";

it("exits 1 when the dist root is a file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "guard-pin-"));
  const file = path.join(dir, "page.html");
  fs.writeFileSync(file, "<html></html>");
  try {
    const result = describeScan(file);
    expect(result.status).toBe(1);
    expect(result.text).toContain("not a directory");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

it("rejects an unsupported json value", () => {
  expect(scanJsonValue(undefined, "inline.json")).toEqual([
    { kind: "parse-error", file: "inline.json", reason: "unsupported json value" },
  ]);
});

it("pins every finding reason to a floor mutant", () => {
  expect(runGuardPinCheck()).toEqual({ status: 0, text: "" });
});
