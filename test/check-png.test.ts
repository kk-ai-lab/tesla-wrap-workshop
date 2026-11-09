import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, it } from "vitest";
import { checkPng } from "../src/domain/spec.ts";

function fixture(name: string): Uint8Array {
  return new Uint8Array(readFileSync(path.resolve("test/fixtures", name)));
}

it("accepts valid.png for model3", () => {
  expect(checkPng(fixture("valid.png"), "valid.png", "model3")).toEqual([]);
});

it("rejects too-big.png at 1000001 bytes", () => {
  const bytes = fixture("too-big.png");
  expect(bytes.byteLength).toBe(1000001);
  expect(checkPng(bytes, "too-big.png", "model3")).toEqual([
    { code: "too-big", bytes: 1000001 },
  ]);
});

it("rejects 1023x1024.png for model3", () => {
  expect(checkPng(fixture("1023x1024.png"), "1023x1024.png", "model3")).toEqual([
    { code: "wrong-dims", got: [1023, 1024], want: [1024, 1024] },
  ]);
});

it("rejects renamed-jpeg.png", () => {
  expect(checkPng(fixture("renamed-jpeg.png"), "renamed-jpeg.png", "model3")).toEqual([
    { code: "not-png" },
  ]);
});

it("rejects abcdefghijklmnopqrstuvwxyz1.png", () => {
  const name = "abcdefghijklmnopqrstuvwxyz1.png";
  expect(checkPng(fixture(name), name, "model3")).toEqual([{ code: "bad-name", name }]);
});

it("rejects a 1024x1024 png for cybertruck", () => {
  expect(
    checkPng(fixture("cybertruck-square.png"), "cybertruck-square.png", "cybertruck"),
  ).toEqual([{ code: "wrong-dims", got: [1024, 1024], want: [1024, 768] }]);
});
