import { ESLint } from "eslint";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { commentLintKinds } from "../eslint.config.js";
import { describeScan, scannerInputKinds } from "./check-dist.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export type InputCheckResult = {
  status: number;
  text: string;
};

function scanFixture(fixture: string): { status: number; text: string } {
  return describeScan(path.join(repoRoot, fixture));
}

function scanSymlink(): { status: number; text: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "scanner-input-"));
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), "scanner-input-target-"));
  fs.writeFileSync(path.join(outside, "probe.js"), "/* hack */\n");
  fs.symlinkSync(outside, path.join(dir, "linked"), "dir");
  try {
    return describeScan(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    fs.rmSync(outside, { recursive: true, force: true });
  }
}

export function runScannerInputCheck(): InputCheckResult {
  const lines: string[] = [];
  const seen = new Map<string, { status: number; text: string }>();
  for (const [id, kind] of Object.entries(scannerInputKinds)) {
    if (kind.coverage === "symlink") {
      const result = scanSymlink();
      if (result.status !== 1 || !result.text.includes(kind.needle)) {
        lines.push(`scanner input kind ${id} has no bad fixture`);
      }
      continue;
    }
    const fixture: string = kind.fixture;
    if (fixture === "") {
      lines.push(`scanner input kind ${id} has no bad fixture`);
      continue;
    }
    const fixturePath = path.join(repoRoot, kind.fixture);
    if (!fs.existsSync(fixturePath)) {
      lines.push(`scanner input kind ${id} has no bad fixture`);
      continue;
    }
    let result = seen.get(kind.fixture);
    if (result === undefined) {
      result = scanFixture(kind.fixture);
      seen.set(kind.fixture, result);
    }
    if (result.status !== 1 || !result.text.includes(kind.needle)) {
      lines.push(`scanner input kind ${id} fixture ${kind.fixture} does not exit 1`);
    }
  }
  return { status: lines.length > 0 ? 1 : 0, text: lines.join("\n") };
}

export async function runCommentLintKindCheck(): Promise<InputCheckResult> {
  const lines: string[] = [];
  const eslint = new ESLint({
    cwd: repoRoot,
    overrideConfigFile: path.join(repoRoot, "eslint.config.js"),
    ignore: false,
  });
  for (const kind of commentLintKinds) {
    if (kind.fixture === "") {
      lines.push(`comment lint kind ${kind.id} has no bad fixture`);
      continue;
    }
    const fixturePath = path.join(repoRoot, kind.fixture);
    if (!fs.existsSync(fixturePath)) {
      lines.push(`comment lint kind ${kind.id} has no bad fixture`);
      continue;
    }
    const results = await eslint.lintFiles([fixturePath]);
    const result = results[0];
    const ruleIds = result?.messages.map((message) => message.ruleId) ?? [];
    if (!ruleIds.includes(kind.rule)) {
      lines.push(`comment lint kind ${kind.id} fixture ${kind.fixture} does not exit 1`);
    }
  }
  return { status: lines.length > 0 ? 1 : 0, text: lines.join("\n") };
}

async function main(): Promise<number> {
  const scanner = runScannerInputCheck();
  const lint = await runCommentLintKindCheck();
  if (scanner.text !== "") console.log(scanner.text);
  if (lint.text !== "") console.log(lint.text);
  return scanner.status !== 0 || lint.status !== 0 ? 1 : 0;
}

const entry = process.argv[1];
if (entry !== undefined && path.resolve(entry) === fileURLToPath(import.meta.url)) {
  main().then((code) => {
    process.exit(code);
  });
}
