import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { requiredMutantIds } from "./check-mutants.ts";
import { findingReasons, reasonMutants } from "./check-dist.ts";

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

export function runGuardPinCheck(): PinCheckResult {
  const lines: string[] = [];
  const floor = new Set<string>(requiredMutantIds);
  const mutants = JSON.parse(readFileSync(path.join(repoRoot, "scripts/mutants.json"), "utf8")) as Mutant[];
  const mutantIds = mutants.map((mutant) => mutant.id);
  for (const id of requiredMutantIds) {
    if (!mutantIds.includes(id)) lines.push(`required mutant ${id} is missing from scripts/mutants.json`);
  }
  for (const id of mutantIds) {
    if (!floor.has(id)) lines.push(`mutant ${id} is not in the required floor`);
  }

  const reasonIds = Object.keys(findingReasons);
  const mappedIds = Object.keys(reasonMutants);
  for (const id of reasonIds) {
    if (!mappedIds.includes(id)) lines.push(`finding reason ${id} has no killing mutant`);
  }
  for (const id of mappedIds) {
    if (!reasonIds.includes(id)) lines.push(`mutant pin ${id} is not a finding reason`);
  }
  const used = new Map<string, string>();
  for (const [id, mutantId] of Object.entries(reasonMutants)) {
    if (!floor.has(mutantId)) lines.push(`mutant ${mutantId} is not in the required floor`);
    const previous = used.get(mutantId);
    if (previous !== undefined) lines.push(`mutant ${mutantId} pins both ${previous} and ${id}`);
    used.set(mutantId, id);
    const mutant = mutants.find((entry) => entry.id === mutantId);
    const tokens = mutant === undefined ? [] : [...mutant.search.matchAll(/"([^"]*)"/g)].map((match) => match[1]);
    if (mutant === undefined || mutant.file !== "scripts/check-dist.ts" || !tokens.includes(id)) {
      lines.push(`finding reason ${id} has no killing mutant`);
    }
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
