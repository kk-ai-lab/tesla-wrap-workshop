import path from "node:path";
import { loadCatalogue } from "../catalogue/load";
import type { Violation } from "../domain/spec";
import { checkRepository } from "../guards/repository";

type Reported = Violation & { wrap: string };

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function formatViolation(violation: Reported): string {
  switch (violation.code) {
    case "invalid-png":
      return `invalid-png ${violation.wrap}`;
    case "not-png":
      return `not-png ${violation.wrap}`;
    case "bad-name":
      return `bad-name ${violation.name} ${violation.wrap}`;
    case "too-big":
      return `too-big ${violation.bytes} bytes ${violation.wrap}`;
    case "wrong-dims":
      return `wrong-dims ${violation.got[0]}x${violation.got[1]} want ${violation.want[0]}x${violation.want[1]} ${violation.wrap}`;
    case "schema":
      return `schema ${violation.path} ${violation.msg} ${violation.wrap}`;
    case "licence-provenance":
      return `licence-provenance ${violation.licence} ${violation.kind} ${violation.wrap}`;
    case "dup-sha":
      return `dup-sha ${violation.sha256} ${violation.ids.join(",")} ${violation.wrap}`;
    case "id-mismatch":
      return `id-mismatch ${violation.folder} ${violation.id} ${violation.wrap}`;
    default: {
      const neverViolation: never = violation;
      throw new Error(`unknown violation ${JSON.stringify(neverViolation)}`);
    }
  }
}

const root = process.argv[2] ?? path.join(process.cwd(), "content/wraps");
const result = await loadCatalogue(root);
const guardFindings = checkRepository(process.cwd());
for (const finding of guardFindings) {
  process.stdout.write(`${finding.rule}: ${finding.file} ${finding.reason}\n`);
}

if (result.ok && guardFindings.length === 0) {
  const count = result.catalogue.wraps.length;
  process.stdout.write(
    `check: ${plural(count, "wrap", "wraps")}, ${plural(0, "violation", "violations")}\n`,
  );
  process.exit(0);
}

if (!result.ok) {
  for (const violation of result.violations) {
    process.stdout.write(`${formatViolation(violation)}\n`);
  }
}
process.exit(1);
