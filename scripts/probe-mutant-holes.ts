import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const killName = "test/hole.test.ts > shared failure";

export const holeScenarios = ["stale", "empty", "missing-m6"] as const;

export type HoleScenario = (typeof holeScenarios)[number];

export type HoleProbeResult = {
  status: number | null;
  stdout: string;
  stderr: string;
};

type MutantEntry = {
  id: string;
  file: string;
  search: string;
  replace: string;
  kills: string;
};

function mutant(id: string, replace: string): MutantEntry {
  return { id, file: "sample.txt", search: "KEEP", replace, kills: killName };
}

const lists: Record<HoleScenario, MutantEntry[]> = {
  stale: [mutant("M1", "ONE"), mutant("M6", "TWO"), mutant("M7", "THREE")],
  empty: [],
  "missing-m6": [mutant("M1", "ONE"), mutant("M7", "THREE")],
};

const modes: Record<HoleScenario, string> = {
  stale: "stale",
  empty: "silent",
  "missing-m6": "write",
};

function fakeVitest(): string {
  return [
    'import { readFileSync, writeFileSync } from "node:fs";',
    'import path from "node:path";',
    'import { fileURLToPath } from "node:url";',
    "const here = path.dirname(fileURLToPath(import.meta.url));",
    'const mode = readFileSync(path.join(here, "mode.txt"), "utf8").trim();',
    'const countPath = path.join(here, "count.txt");',
    "let count = 0;",
    "try {",
    '  count = Number(readFileSync(countPath, "utf8"));',
    "} catch {",
    "  count = 0;",
    "}",
    "writeFileSync(countPath, String(count + 1));",
    'const out = process.argv[process.argv.indexOf("--outputFile") + 1];',
    'if (mode === "stale" && count > 0) process.exit(1);',
    'if (mode === "silent") process.exit(1);',
    "const work = path.dirname(out);",
    'const report = { testResults: [{ name: path.join(work, "test/hole.test.ts"), assertionResults: [{ title: "shared failure", status: "failed" }] }] };',
    "writeFileSync(out, JSON.stringify(report));",
    "process.exit(1);",
    "",
  ].join("\n");
}

export function runHoleProbe(scenario: HoleScenario): HoleProbeResult {
  const sandbox = mkdtempSync(path.join(tmpdir(), "mutant-hole-"));
  try {
    const vitestDir = path.join(sandbox, "node_modules", "vitest");
    mkdirSync(path.join(sandbox, "scripts"), { recursive: true });
    mkdirSync(vitestDir, { recursive: true });
    copyFileSync(path.join(repoRoot, "scripts/check-mutants.ts"), path.join(sandbox, "scripts/check-mutants.ts"));
    writeFileSync(path.join(sandbox, "scripts/mutants.json"), `${JSON.stringify(lists[scenario])}\n`);
    writeFileSync(path.join(sandbox, "package.json"), '{"type":"module"}\n');
    writeFileSync(path.join(sandbox, "sample.txt"), "KEEP\n");
    writeFileSync(path.join(vitestDir, "vitest.mjs"), fakeVitest());
    writeFileSync(path.join(vitestDir, "mode.txt"), modes[scenario]);
    const result = spawnSync(path.join(repoRoot, "node_modules/.bin/tsx"), ["scripts/check-mutants.ts"], {
      cwd: sandbox,
      encoding: "utf8",
    });
    return {
      status: result.status,
      stdout: result.stdout ?? "",
      stderr: result.stderr ?? "",
    };
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
}

function isHoleScenario(value: string): value is HoleScenario {
  return (holeScenarios as readonly string[]).includes(value);
}

function main(): number {
  const scenario = process.argv[2] ?? "";
  if (!isHoleScenario(scenario)) {
    console.error("usage: tsx scripts/probe-mutant-holes.ts stale|empty|missing-m6");
    return 1;
  }
  const result = runHoleProbe(scenario);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  return result.status === null ? 1 : result.status;
}

const entry = process.argv[1];
if (entry !== undefined && path.resolve(entry) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
