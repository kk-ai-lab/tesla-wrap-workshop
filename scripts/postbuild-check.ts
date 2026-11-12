import path from "node:path";
import { pathToFileURL } from "node:url";
import { checkLinks, type LinkFinding } from "./check-links.ts";

const usageLine = "usage: npm run postbuild:check -- [--only links]";

export type CliResult = { exitCode: number; stdout: string[]; stderr: string[] };

function message(finding: LinkFinding): string {
  switch (finding.code) {
    case "missing-page":
      return `links: ${finding.file} is missing for variant ${finding.variant}`;
    case "missing-template-link":
      return `links: ${finding.file} has no template link for variant ${finding.variant}`;
    case "wrong-template-link":
      return `links: ${finding.file} has template link ${finding.href} for variant ${finding.variant}`;
    case "duplicate-template-link":
      return `links: ${finding.file} has ${finding.count} template links for variant ${finding.variant}`;
    case "bad-template-link":
      return `links: ${finding.file} template link ${finding.href} is not a Tesla template folder`;
    case "tesla-hotlink":
      return `links: ${finding.file} ${finding.tag} hotlinks ${finding.url}`;
    case "parse-error":
      return `links: parse error in ${finding.file}: ${finding.reason}`;
  }
}

function parseOnly(argv: string[]): { ok: true; only: string | undefined } | { ok: false } {
  let only: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--only") {
      const value = argv[index + 1];
      if (value === undefined) {
        return { ok: false };
      }
      only = value;
      index += 1;
      continue;
    }
    if (arg?.startsWith("--only=")) {
      only = arg.slice("--only=".length);
      continue;
    }
    return { ok: false };
  }
  if (only !== undefined && only !== "links") {
    return { ok: false };
  }
  return { ok: true, only };
}

export function run(argv: string[], root: string): CliResult {
  const parsed = parseOnly(argv);
  if (!parsed.ok) {
    return { exitCode: 2, stdout: [], stderr: [usageLine] };
  }
  const result = checkLinks(root);
  if (result.ok) {
    return {
      exitCode: 0,
      stdout: [`links: ${result.templateLinks} template links ok, 0 tesla hotlinks`],
      stderr: [],
    };
  }
  return { exitCode: 1, stdout: result.findings.map(message), stderr: [] };
}

function main(): void {
  const result = run(process.argv.slice(2), path.resolve("dist"));
  for (const line of result.stdout) {
    console.log(line);
  }
  for (const line of result.stderr) {
    console.error(line);
  }
  process.exitCode = result.exitCode;
}

const entry = process.argv[1];
if (entry !== undefined && import.meta.url === pathToFileURL(entry).href) {
  main();
}
