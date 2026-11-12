import path from "node:path";
import { pathToFileURL } from "node:url";
import { checkLinks, type LinkFinding } from "./check-links.ts";
import { checkPagePolicy, type PageCheck } from "./check-page-policy.ts";
import { checkRepository } from "../src/guards/repository.ts";
import { launchMode } from "../src/domain/launch.ts";

const usageLine = "usage: npm run postbuild:check -- [--only links|disclaimer|budget|launch|assets]";
type CheckName = "links" | PageCheck | "assets";

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

function isCheck(value: string): value is CheckName {
  return ["links", "disclaimer", "budget", "launch", "assets"].includes(value);
}

function parseOnly(argv: string[]): { ok: true; only: CheckName | undefined } | { ok: false } {
  let only: string | undefined;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--only") {
      if (only !== undefined) return { ok: false };
      const value = argv[index + 1];
      if (value === undefined) {
        return { ok: false };
      }
      only = value;
      index += 1;
      continue;
    }
    if (arg?.startsWith("--only=")) {
      if (only !== undefined) return { ok: false };
      only = arg.slice("--only=".length);
      continue;
    }
    return { ok: false };
  }
  if (only === undefined) return { ok: true, only };
  return isCheck(only) ? { ok: true, only } : { ok: false };
}

export function run(argv: string[], root: string, launchValue = process.env.PUBLIC_LAUNCH): CliResult {
  const parsed = parseOnly(argv);
  if (!parsed.ok) {
    return { exitCode: 2, stdout: [], stderr: [usageLine] };
  }
  const stdout: string[] = [];
  const findings: string[] = [];
  if (parsed.only === undefined || parsed.only === "links") {
    const result = checkLinks(root);
    if (result.ok) stdout.push(`links: ${result.templateLinks} template links ok, 0 tesla hotlinks`);
    else findings.push(...result.findings.map(message));
  }
  if (parsed.only === undefined || ["disclaimer", "budget", "launch"].includes(parsed.only)) {
    try {
      const mode = launchMode(launchValue);
      const only = parsed.only === "disclaimer" || parsed.only === "budget" || parsed.only === "launch" ? parsed.only : undefined;
      const result = checkPagePolicy(root, only, mode);
      findings.push(...result.findings);
      stdout.push(...result.summaries);
    } catch (error) {
      findings.push(`launch: ${error instanceof Error ? error.message : "invalid launch mode"}`);
    }
  }
  if (parsed.only === undefined || parsed.only === "assets") {
    const result = checkRepository(process.cwd(), root);
    findings.push(...result.map((finding) => `${finding.rule}: ${finding.file} ${finding.reason}`));
    if (result.length === 0) stdout.push("assets: no Tesla source copies or denied brand assets");
  }
  return { exitCode: findings.length === 0 ? 0 : 1, stdout: findings.length === 0 ? stdout : findings, stderr: [] };
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
