import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type Mutant = {
  id: string;
  file: string;
  search: string;
  replace: string;
  kills: string;
};

type ReportFile = {
  name?: string;
  assertionResults?: Array<{ title?: string; status?: string }>;
};

type Report = {
  testResults?: ReportFile[];
};

const skipped = new Set(["node_modules", ".git", "dist", ".astro", "test-results", "playwright-report"]);
const requiredMutantIds = ["M1", "M2", "M3", "M4", "M5", "M6", "M7"];

function fail(message: string): never {
  throw new Error(message);
}

function stringField(record: Record<string, unknown>, key: string, index: number): string {
  const value = record[key];
  if (typeof value !== "string" || value === "") fail(`mutant ${index} needs a non-empty ${key}`);
  return value;
}

function readMutants(): Mutant[] {
  const parsed: unknown = JSON.parse(readFileSync(path.join(root, "scripts/mutants.json"), "utf8"));
  if (!Array.isArray(parsed)) fail("scripts/mutants.json must be an array");
  if (parsed.length === 0) fail("scripts/mutants.json is empty");
  const seen = new Set<string>();
  const mutants = parsed.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) fail(`mutant ${index} is not an object`);
    const record = entry as Record<string, unknown>;
    const mutant = {
      id: stringField(record, "id", index),
      file: stringField(record, "file", index),
      search: stringField(record, "search", index),
      replace: stringField(record, "replace", index),
      kills: stringField(record, "kills", index),
    };
    if (mutant.search === mutant.replace) fail(`${mutant.id} search and replace are the same`);
    if (mutant.file.includes("..") || path.isAbsolute(mutant.file)) fail(`${mutant.id} has an unsafe file path`);
    if (!mutant.kills.includes(" > ")) fail(`${mutant.id} kills must be a test file, then ' > ', then a test name`);
    if (seen.has(mutant.id)) fail(`duplicate mutant ${mutant.id}`);
    seen.add(mutant.id);
    return mutant;
  });
  for (const id of requiredMutantIds) {
    if (!seen.has(id)) fail(`scripts/mutants.json is missing ${id}`);
  }
  return mutants;
}

function copyProject(work: string): void {
  cpSync(root, work, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(root, source);
      if (relative === "") return true;
      const top = relative.split(path.sep)[0] ?? relative;
      return !skipped.has(top);
    },
  });
  symlinkSync(path.join(root, "node_modules"), path.join(work, "node_modules"), "dir");
  const env = gitEnv();
  const init = spawnSync("git", ["init", "-q"], { cwd: work, encoding: "utf8", env });
  if (init.status !== 0) fail(`git init failed: ${init.stderr}`);
  const add = spawnSync("git", ["add", "-A"], { cwd: work, encoding: "utf8", env });
  if (add.status !== 0) fail(`git add failed: ${add.stderr}`);
}

function gitEnv(): NodeJS.ProcessEnv {
  const env = { ...process.env };
  delete env.GIT_DIR;
  delete env.GIT_WORK_TREE;
  return env;
}

function applyMutant(work: string, mutant: Mutant): void {
  const original = readFileSync(path.join(root, mutant.file), "utf8");
  const parts = original.split(mutant.search);
  if (parts.length !== 2) fail(`${mutant.id}: search text found ${parts.length - 1} times in ${mutant.file}`);
  writeFileSync(path.join(work, mutant.file), parts.join(mutant.replace));
}

function failingTests(reportPath: string, work: string): string[] {
  const parsed = JSON.parse(readFileSync(reportPath, "utf8")) as Report;
  const names: string[] = [];
  for (const file of parsed.testResults ?? []) {
    if (file.name === undefined) continue;
    const relative = path.relative(work, file.name).split(path.sep).join("/");
    for (const assertion of file.assertionResults ?? []) {
      if (assertion.status === "failed" && assertion.title) names.push(`${relative} > ${assertion.title}`);
    }
  }
  return names;
}

function runMutant(work: string, mutant: Mutant): boolean {
  const originalPath = path.join(root, mutant.file);
  const saved = readFileSync(originalPath);
  const reportPath = path.join(work, "mutant-report.json");
  try {
    applyMutant(work, mutant);
    rmSync(reportPath, { force: true });
    const result = spawnSync(process.execPath, [
      path.join(root, "node_modules/vitest/vitest.mjs"),
      "run",
      "--reporter=json",
      "--outputFile",
      reportPath,
      "--no-color",
    ], {
      cwd: work,
      encoding: "utf8",
      env: gitEnv(),
      timeout: 180_000,
    });
    let failed: string[] = [];
    try {
      failed = failingTests(reportPath, work);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      const tail = `${result.stdout}\n${result.stderr}`.trim().split("\n").slice(-20).join("\n");
      console.log(`${mutant.id} error`);
      console.log(`expected ${mutant.kills}`);
      console.log(detail);
      if (tail !== "") console.log(tail);
      return false;
    }
    if (!failed.includes(mutant.kills)) {
      console.log(`${mutant.id} survived`);
      console.log(`expected ${mutant.kills}`);
      for (const name of failed) console.log(name);
      return false;
    }
    if (result.error !== undefined || result.status === null) {
      console.log(`${mutant.id} error`);
      console.log(result.error?.message ?? result.signal ?? "vitest did not finish");
      return false;
    }
    if (result.status === 0) {
      console.log(`${mutant.id} error`);
      console.log(`expected ${mutant.kills}`);
      console.log("vitest exited 0");
      return false;
    }
    console.log(`${mutant.id} killed (${failed.length} failed)`);
    for (const name of failed) console.log(name);
    return true;
  } finally {
    writeFileSync(path.join(work, mutant.file), saved);
  }
}

function main(): number {
  const started = performance.now();
  const work = mkdtempSync(path.join(tmpdir(), "check-mutants-"));
  let exitCode = 0;
  try {
    copyProject(work);
    for (const mutant of readMutants()) {
      if (!runMutant(work, mutant)) exitCode = 1;
    }
  } catch (error) {
    exitCode = 1;
    console.error(error instanceof Error ? error.message : String(error));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
  const seconds = ((performance.now() - started) / 1000).toFixed(1);
  console.log(`check:mutants ${seconds}s`);
  return exitCode;
}

process.exit(main());
