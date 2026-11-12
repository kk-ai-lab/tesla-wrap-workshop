import path from "node:path";
import { checkLinks, type LinkFinding } from "./check-links.ts";

function usage(): never {
  console.error("usage: npm run postbuild:check -- [--only links]");
  process.exit(2);
}

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
    case "tesla-hotlink":
      return `links: ${finding.file} ${finding.tag} hotlinks ${finding.url}`;
    case "parse-error":
      return `links: parse error in ${finding.file}: ${finding.reason}`;
  }
}

function main(): void {
  const args = process.argv.slice(2);
  let only: string | undefined;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--only") {
      const value = args[index + 1];
      if (value === undefined) {
        usage();
      }
      only = value;
      index += 1;
      continue;
    }
    if (arg?.startsWith("--only=")) {
      only = arg.slice("--only=".length);
      continue;
    }
    usage();
  }

  if (only !== undefined && only !== "links") {
    usage();
  }

  const root = path.resolve("dist");
  const result = checkLinks(root);
  if (result.ok) {
    console.log(`links: ${result.templateLinks} template links ok, 0 tesla hotlinks`);
    return;
  }
  for (const finding of result.findings) {
    console.log(message(finding));
  }
  process.exitCode = 1;
}

main();
