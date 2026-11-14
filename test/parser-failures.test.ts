import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const root = fileURLToPath(new URL("..", import.meta.url));
const scanner = path.join(root, "scripts/check-dist.ts");

function runSeeded(before: string, after: string, html: string, expected: { reason: string; detail?: string }): void {
  const source = fs.readFileSync(scanner, "utf8");
  expect(source.split(before)).toHaveLength(2);
  const script = path.join(root, "scripts", `.seeded-${process.pid}-${Math.random().toString(36).slice(2)}.ts`);
  const runner = script.replace(".ts", "-runner.ts");
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "parser-failure-"));
  try {
    fs.writeFileSync(script, source.replace(before, after));
    fs.writeFileSync(path.join(fixture, "index.html"), html);
    fs.writeFileSync(runner, `import { scanRoot } from ${JSON.stringify(script)};\nconsole.log(JSON.stringify(scanRoot(process.argv[2])));\n`);
    const result = spawnSync(process.execPath, [path.join(root, "node_modules/tsx/dist/cli.mjs"), runner, fixture], { cwd: root, encoding: "utf8" });
    expect(result.status).toBe(0);
    const findings: unknown = JSON.parse(result.stdout);
    expect(findings).toEqual(expect.arrayContaining([expect.objectContaining({ kind: "parse-error", ...expected })]));
  } finally {
    fs.rmSync(script, { force: true });
    fs.rmSync(runner, { force: true });
    fs.rmSync(fixture, { recursive: true, force: true });
  }
}

it("reports a failed JSON key scan", () => {
  runSeeded('  function readString(): string | undefined {', '  function readString(): string | undefined {\n    return undefined;', '<!doctype html><script type="application/ld+json">{"key":"value"}</script>', { reason: "json-key-scanner", detail: "Unable to scan JSON keys" });
});

it("reports an HTML parser exception", () => {
  runSeeded('    document = parseHtml(html, {', '    throw new Error("forced HTML failure");\n    document = parseHtml(html, {', '<!doctype html><p>ok</p>', { reason: "html-parser", detail: "forced HTML failure" });
});

it("reports an HTML fragment parser exception", () => {
  runSeeded('    fragment = parseFragment(html, {', '    throw new Error("forced fragment failure");\n    fragment = parseFragment(html, {', '<!doctype html><script type="application/ld+json">{"key":"value"}</script>', { reason: "html-fragment-parser", detail: "forced fragment failure" });
});

it("reports a root stat failure", () => {
  runSeeded('    stats = fs.statSync(root);', '    throw new Error("forced stat failure");\n    stats = fs.statSync(root);', '<!doctype html>', { reason: "root-stat", detail: "forced stat failure" });
});

it("reports a file read failure", () => {
  runSeeded('      source = fs.readFileSync(entry.path, "utf8");', '      throw new Error("forced read failure");\n      source = fs.readFileSync(entry.path, "utf8");', '<!doctype html>', { reason: "file-read", detail: "forced read failure" });
});

it("reports a directory read failure", () => {
  runSeeded('    entries = listEntries(root).sort((left, right) => left.path.localeCompare(right.path));', '    throw new Error("forced directory read failure");\n    entries = listEntries(root).sort((left, right) => left.path.localeCompare(right.path));', '<!doctype html>', { reason: "directory-read", detail: "forced directory read failure" });
});

it("reports the JavaScript fallback when no parser attempt provides a reason", () => {
  runSeeded('  const attempts: SourceType[] = preferred === "module" ? ["module", "script"] : ["script", "module"];', '  const attempts: SourceType[] = [];', '<!doctype html><script>invalid(</script>', { reason: "parse error" });
});
