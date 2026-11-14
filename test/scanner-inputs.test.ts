import { cpSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { commentLintKinds } from "../eslint.config.js";
import { scannerInputKinds } from "../scripts/check-dist.ts";
import { runCommentLintKindCheck, runScannerInputCheck } from "../scripts/check-scanner-inputs.ts";

const distKindIds = [
  "script-classic",
  "script-module",
  "script-json",
  "script-unknown",
  "attr-style",
  "attr-event",
  "attr-srcdoc",
  "json-key",
  "json-value",
  "json-duplicate-key",
  "json-invalid",
  "extension-html",
  "extension-css",
  "extension-js",
  "extension-mjs",
  "extension-cjs",
  "extension-unknown",
  "tag-style",
  "tag-script",
  "noscript",
  "svg-inline",
  "svg-file",
  "script-extra-attr",
  "opaque-png",
  "opaque-jpg",
  "opaque-jpeg",
  "opaque-gif",
  "opaque-webp",
  "opaque-avif",
  "opaque-ico",
  "opaque-bmp",
  "opaque-woff",
  "opaque-woff2",
  "opaque-ttf",
  "opaque-otf",
  "opaque-eot",
  "robots-txt",
  "symlink",
  "parse-error",
];

const commentLintKindIds = [
  "astro-html",
  "astro-style",
  "astro-set-directive",
  "astro-style-attribute",
  "astro-uninspected-style",
  "ts-line-comment",
  "astro-frontmatter",
];

it("pins the dist scanner input kind ids", () => {
  expect(Object.keys(scannerInputKinds)).toEqual(distKindIds);
});

it("pins the comment lint kind ids", () => {
  expect(commentLintKinds.map((kind) => kind.id)).toEqual(commentLintKindIds);
});

it("every dist scanner input kind has a bad fixture", () => {
  const result = runScannerInputCheck();
  expect(result).toEqual({ status: 0, text: "" });
});

it("every comment lint kind has a bad fixture", async () => {
  const result = await runCommentLintKindCheck();
  expect(result).toEqual({ status: 0, text: "" });
});

function withFixtureCopy(check: (root: string) => void): void {
  const root = mkdtempSync(path.join(tmpdir(), "scanner-witness-"));
  const source = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "lint-fixtures/check-dist");
  const destination = path.join(root, "test/lint-fixtures/check-dist");
  try {
    mkdirSync(path.dirname(destination), { recursive: true });
    cpSync(source, destination, { recursive: true });
    check(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

it("rejects missing skip witnesses", () => {
  withFixtureCopy((root) => {
    rmSync(path.join(root, "test/lint-fixtures/check-dist/opaque/x.png"));
    rmSync(path.join(root, "test/lint-fixtures/check-dist/robots/robots.txt"));
    const result = runScannerInputCheck(root);
    expect(result.status).toBe(1);
    expect(result.text).toContain("scanner input kind opaque-png fixture test/lint-fixtures/check-dist/opaque has no regular witness");
    expect(result.text).toContain("scanner input kind robots-txt fixture test/lint-fixtures/check-dist/robots has no regular witness");
  });
});

it("requires a regular witness for each opaque extension", () => {
  withFixtureCopy((root) => {
    for (const [id, kind] of Object.entries(scannerInputKinds)) {
      if (kind.group !== "opaque") continue;
      rmSync(path.join(root, kind.fixture, `x${kind.extension}`));
      const result = runScannerInputCheck(root);
      expect(result.status).toBe(1);
      expect(result.text).toContain(`scanner input kind ${id} fixture ${kind.fixture} has no regular witness`);
    }
  });
});

it("does not accept directories or symlinks as skip witnesses", () => {
  withFixtureCopy((root) => {
    const opaque = path.join(root, "test/lint-fixtures/check-dist/opaque/x.png");
    const robots = path.join(root, "test/lint-fixtures/check-dist/robots/robots.txt");
    rmSync(opaque);
    rmSync(robots);
    mkdirSync(opaque);
    symlinkSync(path.join(root, "test/lint-fixtures/check-dist/opaque/x.jpg"), robots);
    const result = runScannerInputCheck(root);
    expect(result.status).toBe(1);
    expect(result.text).toContain("scanner input kind opaque-png fixture test/lint-fixtures/check-dist/opaque has no regular witness");
    expect(result.text).toContain("scanner input kind robots-txt fixture test/lint-fixtures/check-dist/robots has no regular witness");
  });
});

it("requires the declared root-skip filename", () => {
  withFixtureCopy((root) => {
    const fixture = path.join(root, "test/lint-fixtures/check-dist/robots");
    rmSync(path.join(fixture, "robots.txt"));
    writeFileSync(path.join(fixture, "unrelated.png"), "fixture");
    const result = runScannerInputCheck(root);
    expect(result.status).toBe(1);
    expect(result.text).toContain("scanner input kind robots-txt fixture test/lint-fixtures/check-dist/robots has no regular witness");
  });
});

it("rejects a scanner input fixture that no longer fails", () => {
  withFixtureCopy((root) => {
    writeFileSync(path.join(root, "test/lint-fixtures/check-dist/inline-script/index.html"), "<!doctype html><script>const value = 1;</script>");
    const result = runScannerInputCheck(root);
    expect(result.status).toBe(1);
    expect(result.text).toContain("scanner input kind script-classic fixture test/lint-fixtures/check-dist/inline-script does not exit 1");
  });
});

it("rejects a scanner input fixture that fails for a different reason", () => {
  withFixtureCopy((root) => {
    writeFileSync(path.join(root, "test/lint-fixtures/check-dist/inline-script/index.html"), "<!doctype html><!-- x --><script>const value = 1;</script>");
    const result = runScannerInputCheck(root);
    expect(result.status).toBe(1);
    expect(result.text).toContain("scanner input kind script-classic fixture test/lint-fixtures/check-dist/inline-script does not exit 1");
  });
});
