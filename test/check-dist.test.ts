import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";
import { scanRoot } from "../scripts/check-dist.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const tsxCli = path.join(root, "node_modules/tsx/dist/cli.mjs");

function runScan(fixture: string) {
  return spawnSync(process.execPath, [tsxCli, "scripts/check-dist.ts", fixture], {
    cwd: root,
    encoding: "utf8",
  });
}

function expectExit(fixture: string, status: number, needle: string) {
  const result = runScan(fixture);
  expect(result.status).toBe(status);
  if (status === 0) {
    expect(result.stdout).toBe("");
  } else {
    expect(result.stdout).toContain(needle);
  }
  return result;
}

it("exits 1 for a define:vars comment in built html", () => {
  const fixture = "test/lint-fixtures/check-dist/define-vars";
  const result = expectExit(fixture, 1, "css comment");
  expect(result.stdout).toContain("index.html");
  const findings = scanRoot(path.join(root, fixture));
  expect(findings.some((finding) => finding.kind === "comment" && finding.language === "css")).toBe(
    true,
  );
});

it("exits 1 for a frontmatter literal copied into a style attribute", () => {
  expectExit("test/lint-fixtures/check-dist/frontmatter-style", 1, "css comment");
});

it("exits 1 for set:html on style", () => {
  expectExit("test/lint-fixtures/check-dist/style-set-html", 1, "css comment");
});

it("exits 1 for a style attribute comment", () => {
  expectExit("test/lint-fixtures/check-dist/style-attr", 1, "css comment");
});

it("exits 1 for an inline script comment", () => {
  const result = expectExit("test/lint-fixtures/check-dist/inline-script", 1, "js comment");
  expect(result.stdout).toContain("index.html");
});

it("exits 1 for an html comment", () => {
  expectExit("test/lint-fixtures/check-dist/html-comment", 1, "html comment");
});

it("exits 0 when a block comment sits inside a js string", () => {
  expectExit("test/lint-fixtures/check-dist/js-string", 0, "");
});

it("exits 0 when a block comment sits inside a css string", () => {
  expectExit("test/lint-fixtures/check-dist/css-string", 0, "");
});

it("exits 0 when a block comment sits inside a css url", () => {
  expectExit("test/lint-fixtures/check-dist/css-url", 0, "");
});

it("exits 0 for an allowlisted html comment", () => {
  expectExit("test/lint-fixtures/check-dist/allow-html", 0, "");
});

it("exits 0 for an allowlisted css comment", () => {
  expectExit("test/lint-fixtures/check-dist/allow-css", 0, "");
});

it("exits 0 for an allowlisted js comment", () => {
  expectExit("test/lint-fixtures/check-dist/allow-js", 0, "");
});

it("exits 1 when an issue url comment has extra text", () => {
  expectExit("test/lint-fixtures/check-dist/allow-miss", 1, "css comment");
});

it("exits 1 when css cannot be parsed", () => {
  const result = expectExit("test/lint-fixtures/check-dist/broken-css", 1, "parse error in main.css:");
  expect(result.stdout).toContain("main.css");
});

it("exits 1 when js cannot be parsed", () => {
  const result = expectExit("test/lint-fixtures/check-dist/broken-js", 1, "parse error in main.js:");
  expect(result.stdout).toContain("main.js");
});

it("exits 1 for an html comment inside noscript", () => {
  const result = expectExit("test/lint-fixtures/check-dist/noscript-comment", 1, "html comment");
  expect(result.stdout).toContain("index.html");
});

it("exits 1 for a css comment inside noscript", () => {
  const result = expectExit("test/lint-fixtures/check-dist/noscript-style", 1, "css comment");
  expect(result.stdout).toContain("index.html");
});

it("exits 1 for a comment in an event handler", () => {
  const result = expectExit("test/lint-fixtures/check-dist/event-handler", 1, "js comment");
  expect(result.stdout).toContain("index.html");
});

it("exits 0 for a return in an event handler", () => {
  expectExit("test/lint-fixtures/check-dist/event-handler-return", 0, "");
});

it("exits 0 when an event handler string contains a block comment", () => {
  expectExit("test/lint-fixtures/check-dist/event-handler-string", 0, "");
});

it("exits 1 when html ends inside a tag", () => {
  const result = expectExit("test/lint-fixtures/check-dist/malformed-html", 1, "eof-in-tag");
  expect(result.stdout).toContain("index.html");
});

it("exits 1 for comments in mjs, cjs, and uppercase extensions", () => {
  const result = expectExit("test/lint-fixtures/check-dist/extensions", 1, "comment");
  expect(result.stdout).toContain("html comment in probe.HTML");
  expect(result.stdout).toContain("css comment in probe.CSS");
  expect(result.stdout).toContain("js comment in probe.JS");
  expect(result.stdout).toContain("js comment in probe.mjs");
  expect(result.stdout).toContain("js comment in probe.cjs");
});

it("exits 1 for an unknown extension", () => {
  const result = expectExit("test/lint-fixtures/check-dist/unknown-extension", 1, "unknown extension");
  expect(result.stdout).toContain("x.weird");
});

it("exits 1 for a directory symlink", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "check-dist-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "check-dist-target-"));
  fs.writeFileSync(path.join(outside, "probe.js"), "/* hack */\n");
  fs.symlinkSync(outside, path.join(dir, "linked"), "dir");
  try {
    const result = runScan(dir);
    expect(result.status).toBe(1);
    expect(result.stdout).toContain("symlink");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
});

it("runs check:dist after build in ci", () => {
  const ci = fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8");
  const buildAt = ci.indexOf("npm run build");
  const checkAt = ci.indexOf("npm run check:dist");
  expect(buildAt).toBeGreaterThan(-1);
  expect(checkAt).toBeGreaterThan(buildAt);
  expect(ci.match(/npm run check:dist/g)).toHaveLength(1);
});
