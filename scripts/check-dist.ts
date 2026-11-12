import { parse as parseJs, type ecmaVersion } from "acorn";
import { createRequire } from "node:module";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseHtml, parseFragment, type DefaultTreeAdapterMap, type ParserError } from "parse5";
import postcss from "postcss";
import { allowsComment } from "./comment-allowlist.js";

type Node = DefaultTreeAdapterMap["node"];
type ElementNode = DefaultTreeAdapterMap["element"];
type CommentLanguage = "html" | "css" | "js";
type SourceType = "script" | "module";

export type Finding =
  | { kind: "comment"; language: CommentLanguage; file: string }
  | { kind: "parse-error"; file: string; reason: string };

type CssToken = [string, string, ...number[]];

type CssTokenizer = {
  endOfFile: () => boolean;
  nextToken: () => CssToken | undefined;
};

type CssInput = {
  css: string;
  error: (message: string, pos: number) => Error;
};

const require = createRequire(import.meta.url);
const postcssDir = path.dirname(require.resolve("postcss/package.json"));
const tokenize = require(path.join(postcssDir, "lib/tokenize.js")) as (
  input: CssInput,
) => CssTokenizer;
const CssInput = require(path.join(postcssDir, "lib/input.js")) as new (css: string) => CssInput;

const classicScriptTypes = new Set([
  "",
  "text/javascript",
  "application/javascript",
  "text/ecmascript",
  "application/ecmascript",
]);

const nonJsScriptTypes = new Set([
  "application/json",
  "application/ld+json",
  "importmap",
  "speculationrules",
]);

const extensionLanguage = new Map<string, CommentLanguage>([
  [".html", "html"],
  [".css", "css"],
  [".js", "js"],
  [".mjs", "js"],
  [".cjs", "js"],
]);

const opaqueExtensions = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".ico",
  ".bmp",
  ".woff",
  ".woff2",
  ".ttf",
  ".otf",
  ".eot",
]);

function errorReason(error: unknown): string {
  if (error instanceof Error) {
    const withReason = error as Error & { reason?: unknown };
    if (typeof withReason.reason === "string" && withReason.reason.length > 0) {
      return withReason.reason;
    }
    const line = error.message.split("\n")[0];
    return line === undefined || line.length === 0 ? "parse error" : line;
  }
  return "parse error";
}

function commentFindings(language: CommentLanguage, file: string, bodies: string[]): Finding[] {
  return bodies
    .filter((body) => !allowsComment(body))
    .map(() => ({ kind: "comment", language, file }));
}

function cssCommentBodies(css: string): string[] {
  const input = new CssInput(css);
  const tokenizer = tokenize(input);
  const bodies: string[] = [];
  while (!tokenizer.endOfFile()) {
    const token = tokenizer.nextToken();
    if (token === undefined) {
      break;
    }
    if (token[0] !== "comment") {
      continue;
    }
    const text = token[1];
    bodies.push(text.startsWith("/*") && text.endsWith("*/") ? text.slice(2, -2) : text);
  }
  return bodies;
}

function scanCss(css: string, file: string): Finding[] {
  try {
    postcss.parse(css);
    return commentFindings("css", file, cssCommentBodies(css));
  } catch (error) {
    return [{ kind: "parse-error", file, reason: errorReason(error) }];
  }
}

function jsCommentBodies(code: string, sourceType: SourceType): string[] {
  const bodies: string[] = [];
  const ecmaVersion: ecmaVersion = "latest";
  parseJs(code, {
    ecmaVersion,
    sourceType,
    allowHashBang: true,
    onComment(_isBlock, text) {
      bodies.push(text);
    },
  });
  return bodies;
}

function scanEventHandler(code: string, file: string): Finding[] {
  return scanJs(`function onEvent(){\n${code}\n}`, file, "script");
}

function isEventHandler(name: string): boolean {
  return name.startsWith("on") && name.length > 2;
}

function scanJs(code: string, file: string, preferred: SourceType): Finding[] {
  const attempts: SourceType[] = preferred === "module" ? ["module", "script"] : ["script", "module"];
  let reason: string | undefined;
  for (const sourceType of attempts) {
    try {
      return commentFindings("js", file, jsCommentBodies(code, sourceType));
    } catch (error) {
      if (reason === undefined) {
        reason = errorReason(error);
      }
    }
  }
  return [{ kind: "parse-error", file, reason: reason ?? "parse error" }];
}

function isElement(node: Node): node is ElementNode {
  return "tagName" in node && typeof node.tagName === "string";
}

function elementText(element: ElementNode): string {
  let text = "";
  for (const child of element.childNodes) {
    if (child.nodeName === "#text" && "value" in child) {
      text += child.value;
    }
  }
  return text;
}

function scriptSource(typeValue: string | undefined): SourceType | "skip" | "unknown" {
  if (typeValue === undefined) {
    return "script";
  }
  const type = typeValue.trim().toLowerCase();
  if (type === "module") {
    return "module";
  }
  if (classicScriptTypes.has(type)) {
    return "script";
  }
  if (nonJsScriptTypes.has(type)) {
    return "skip";
  }
  return "unknown";
}

function children(node: Node): Node[] {
  if (node.nodeName === "template" && "content" in node) {
    return node.content.childNodes;
  }
  if ("childNodes" in node) {
    return node.childNodes;
  }
  return [];
}

function walk(node: Node, file: string, findings: Finding[]) {
  if (node.nodeName === "#comment" && "data" in node) {
    findings.push(...commentFindings("html", file, [node.data]));
  }
  if (isElement(node)) {
    for (const attribute of node.attrs) {
      const name = attribute.name.toLowerCase();
      if (name === "style") {
        findings.push(...scanCss(attribute.value, file));
      } else if (isEventHandler(name)) {
        findings.push(...scanEventHandler(attribute.value, file));
      }
    }
    if (node.tagName === "style") {
      findings.push(...scanCss(elementText(node), file));
    }
    if (node.tagName === "script") {
      const kind = scriptSource(node.attrs.find((attribute) => attribute.name === "type")?.value);
      const code = elementText(node);
      if (kind === "unknown") {
        findings.push({
          kind: "parse-error",
          file,
          reason: "unsupported script type",
        });
      } else if (kind !== "skip") {
        findings.push(...scanJs(code, file, kind));
      }
    }
    if (node.tagName === "noscript") {
      findings.push(...scanHtmlFragment(elementText(node), file));
    }
  }
  for (const child of children(node)) {
    walk(child, file, findings);
  }
}

function recordParseErrors(errors: ParserError["code"][], file: string, findings: Finding[]) {
  for (const code of errors) {
    findings.push({ kind: "parse-error", file, reason: code });
  }
}

function scanHtmlFragment(html: string, file: string): Finding[] {
  if (html.trim() === "") {
    return [];
  }
  const errors: ParserError["code"][] = [];
  let fragment: Node;
  try {
    fragment = parseFragment(html, {
      scriptingEnabled: true,
      onParseError(error) {
        errors.push(error.code);
      },
    });
  } catch (error) {
    return [{ kind: "parse-error", file, reason: errorReason(error) }];
  }
  const findings: Finding[] = [];
  recordParseErrors(errors, file, findings);
  walk(fragment, file, findings);
  return findings;
}

function scanHtml(html: string, file: string): Finding[] {
  const errors: ParserError["code"][] = [];
  let document: Node;
  try {
    document = parseHtml(html, {
      scriptingEnabled: true,
      onParseError(error) {
        errors.push(error.code);
      },
    });
  } catch (error) {
    return [{ kind: "parse-error", file, reason: errorReason(error) }];
  }
  const findings: Finding[] = [];
  recordParseErrors(errors, file, findings);
  walk(document, file, findings);
  return findings;
}

function relativeFile(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join("/");
}

type ListedEntry = { kind: "file" | "symlink"; path: string };

function listEntries(dir: string): ListedEntry[] {
  const entries: ListedEntry[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      entries.push({ kind: "symlink", path: full });
      continue;
    }
    if (entry.isDirectory()) {
      entries.push(...listEntries(full));
      continue;
    }
    if (entry.isFile()) {
      entries.push({ kind: "file", path: full });
    }
  }
  return entries;
}

export function scanRoot(root: string): Finding[] {
  let stats: fs.Stats;
  try {
    stats = fs.statSync(root);
  } catch (error) {
    return [{ kind: "parse-error", file: root, reason: errorReason(error) }];
  }
  if (!stats.isDirectory()) {
    return [{ kind: "parse-error", file: root, reason: "not a directory" }];
  }
  const findings: Finding[] = [];
  const entries = listEntries(root).sort((left, right) => left.path.localeCompare(right.path));
  for (const entry of entries) {
    const relative = relativeFile(root, entry.path);
    if (entry.kind === "symlink") {
      findings.push({ kind: "parse-error", file: relative, reason: "symlink" });
      continue;
    }
    const extension = path.extname(entry.path).toLowerCase();
    if (relative === "robots.txt") continue;
    const language = extensionLanguage.get(extension);
    if (language === undefined) {
      if (!opaqueExtensions.has(extension)) {
        findings.push({ kind: "parse-error", file: relative, reason: "unknown extension" });
      }
      continue;
    }
    let source: string;
    try {
      source = fs.readFileSync(entry.path, "utf8");
    } catch (error) {
      findings.push({ kind: "parse-error", file: relative, reason: errorReason(error) });
      continue;
    }
    if (language === "html") {
      findings.push(...scanHtml(source, relative));
    } else if (language === "css") {
      findings.push(...scanCss(source, relative));
    } else {
      findings.push(...scanJs(source, relative, "module"));
    }
  }
  return findings;
}

function formatFinding(finding: Finding): string {
  if (finding.kind === "comment") {
    return `${finding.language} comment in ${finding.file}`;
  }
  return `parse error in ${finding.file}: ${finding.reason}`;
}

function main() {
  const root = process.argv[2] ?? "dist";
  const findings = scanRoot(root);
  for (const finding of findings) {
    console.log(formatFinding(finding));
  }
  if (findings.length > 0) {
    process.exitCode = 1;
  }
}

const entry = process.argv[1];
if (entry !== undefined && path.resolve(entry) === fileURLToPath(import.meta.url)) {
  main();
}
