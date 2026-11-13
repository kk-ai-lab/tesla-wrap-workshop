import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

type Mutant = {
  id: string;
  file: string;
  search: string;
};

export type PinCheckResult = {
  status: number;
  text: string;
};

function readRequired(source: string): string[] {
  const match = source.match(/const requiredMutantIds = (\[[\s\S]*?\]);/);
  if (match === null || match[1] === undefined) {
    throw new Error("requiredMutantIds is missing");
  }
  const parsed: unknown = JSON.parse(match[1]);
  if (!Array.isArray(parsed) || parsed.some((id) => typeof id !== "string")) {
    throw new Error("requiredMutantIds must be a string array");
  }
  return parsed as string[];
}

function findingReasons(source: string): string[] {
  const reasons = new Set<string>();
  for (const line of source.split("\n")) {
    const direct = line.match(/reason:\s*"([^"]*)"/);
    if (direct?.[1] !== undefined) reasons.add(direct[1]);
    const ternary = line.match(/const reason = scan === "duplicate" \? "([^"]*)" : "([^"]*)"/);
    if (ternary?.[1] !== undefined && ternary[2] !== undefined) {
      reasons.add(ternary[1]);
      reasons.add(ternary[2]);
    }
  }
  return [...reasons];
}

function guardCalls(source: string): string[] {
  return [...source.matchAll(/guardBranch\("([^"]+)"\)/g)].map((match) => match[1] ?? "");
}

function guardArray(source: string): string[] {
  const match = source.match(/const distGuardIds = \[([\s\S]*?)\] as const/);
  if (match === null || match[1] === undefined) return [];
  return [...match[1].matchAll(/"([^"]+)"/g)].map((item) => item[1] ?? "");
}

export function runGuardPinCheck(): PinCheckResult {
  const lines: string[] = [];
  const mutantsSource = readFileSync(path.join(repoRoot, "scripts/check-mutants.ts"), "utf8");
  const required = readRequired(mutantsSource);
  const mutants = JSON.parse(readFileSync(path.join(repoRoot, "scripts/mutants.json"), "utf8")) as Mutant[];
  const requiredSet = new Set(required);
  const mutantIds = mutants.map((mutant) => mutant.id);
  for (const id of required) {
    if (!mutantIds.includes(id)) lines.push(`required mutant ${id} is missing from scripts/mutants.json`);
  }
  for (const id of mutantIds) {
    if (!requiredSet.has(id)) lines.push(`mutant ${id} is not in the required floor`);
  }

  const distSource = readFileSync(path.join(repoRoot, "scripts/check-dist.ts"), "utf8");
  for (const match of distSource.matchAll(/guardBranch\(/g)) {
    const index = match.index ?? 0;
    const before = distSource.slice(Math.max(0, index - 9), index);
    if (before.endsWith("function ")) continue;
    const after = distSource.slice(index + "guardBranch(".length);
    if (!/^\s*"/.test(after)) lines.push("guardBranch needs a string literal id");
  }
  const calls = new Set(guardCalls(distSource));
  const listed = new Set(guardArray(distSource));
  const distMutants = mutants.filter((mutant) => mutant.file === "scripts/check-dist.ts");
  for (const id of listed) {
    if (!calls.has(id)) lines.push(`guard ${id} is not on a branch`);
  }
  for (const id of calls) {
    if (!listed.has(id)) lines.push(`guard ${id} is not in distGuardIds`);
    if (!requiredSet.has(id) || !distMutants.some((mutant) => mutant.id === id)) {
      lines.push(`guard ${id} is not in the required floor`);
    }
  }
  for (const mutant of distMutants) {
    if (!calls.has(mutant.id)) lines.push(`guard ${mutant.id} is not on a branch`);
  }

  for (const reason of findingReasons(distSource)) {
    const pinned = distMutants.some((mutant) => requiredSet.has(mutant.id) && mutant.search.includes(reason));
    if (!pinned) lines.push(`finding reason "${reason}" has no killing mutant`);
  }

  return { status: lines.length > 0 ? 1 : 0, text: lines.join("\n") };
}

function main(): number {
  const result = runGuardPinCheck();
  if (result.text !== "") console.log(result.text);
  return result.status;
}

const entry = process.argv[1];
if (entry !== undefined && path.resolve(entry) === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
