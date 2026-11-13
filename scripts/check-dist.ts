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

export const scannerInputKinds = {
  "script-classic": {
    group: "script-type",
    scan: "script",
    types: ["", "text/javascript", "application/javascript", "text/ecmascript", "application/ecmascript"],
    coverage: "files",
    fixture: "test/lint-fixtures/check-dist/inline-script",
    needle: "js comment",
  },
  "script-module": {
    group: "script-type",
    scan: "module",
    types: ["module"],
    coverage: "files",
    fixture: "test/lint-fixtures/check-dist/script-module",
    needle: "js comment",
  },
  "script-json": {
    group: "script-type",
    scan: "json",
    types: ["application/json", "application/ld+json", "importmap", "speculationrules"],
    coverage: "files",
    fixture: "test/lint-fixtures/check-dist/json-forbidden",
    needle: "html comment",
  },
  "script-unknown": {
    group: "script-type",
    scan: "reject",
    types: [],
    coverage: "files",
    fixture: "test/lint-fixtures/check-dist/unknown-script-type",
    needle: "unsupported script type",
  },
  "attr-style": {
    group: "attribute",
    coverage: "files",
    fixture: "test/lint-fixtures/check-dist/style-attr",
    needle: "css comment",
  },
  "attr-event": {
    group: "attribute",
    coverage: "files",
    fixture: "test/lint-fixtures/check-dist/event-handler",
    needle: "js comment",
  },
  "attr-srcdoc": {
    group: "attribute",
    coverage: "files",
    fixture: "test/lint-fixtures/check-dist/srcdoc-comment",
    needle: "html comment",
  },
  "json-key": {
    group: "json",
    coverage: "files",
    fixture: "test/lint-fixtures/check-dist/json-key-comment",
    needle: "html comment",
  },
  "json-value": {
    group: "json",
    coverage: "files",
    fixture: "test/lint-fixtures/check-dist/json-forbidden",
    needle: "html comment",
  },
  "json-duplicate-key": {
    group: "json",
    coverage: "files",
    fixture: "test/lint-fixtures/check-dist/json-duplicate-key",
    needle: "duplicate json key",
  },
  "json-invalid": {
    group: "json",
    coverage: "files",
    fixture: "test/lint-fixtures/check-dist/ld-json-invalid",
    needle: "in JSON",
  },
  "extension-html": {
    group: "extension",
    extension: ".html",
    language: "html",
    coverage: "files",
    fixture: "test/lint-fixtures/check-dist/extensions",
    needle: "html comment in probe.HTML",
  },
  "extension-css": {
    group: "extension",
    extension: ".css",
    language: "css",
    coverage: "files",
    fixture: "test/lint-fixtures/check-dist/extensions",
    needle: "css comment in probe.CSS",
  },
  "extension-js": {
    group: "extension",
    extension: ".js",
    language: "js",
    coverage: "files",
    fixture: "test/lint-fixtures/check-dist/extensions",
    needle: "js comment in probe.JS",
  },
  "extension-mjs": {
    group: "extension",
    extension: ".mjs",
    language: "js",
    coverage: "files",
    fixture: "test/lint-fixtures/check-dist/extensions",
    needle: "js comment in probe.mjs",
  },
  "extension-cjs": {
    group: "extension",
    extension: ".cjs",
    language: "js",
    coverage: "files",
    fixture: "test/lint-fixtures/check-dist/extensions",
    needle: "js comment in probe.cjs",
  },
  "extension-unknown": {
    group: "extension",
    coverage: "files",
    fixture: "test/lint-fixtures/check-dist/unknown-extension",
    needle: "unknown extension",
  },
  noscript: {
    group: "tag",
    coverage: "files",
    fixture: "test/lint-fixtures/check-dist/noscript-comment",
    needle: "html comment",
  },
  symlink: {
    group: "entry",
    coverage: "symlink",
    fixture: "",
    needle: "symlink",
  },
  "parse-error": {
    group: "parse-error",
    coverage: "files",
    fixture: "test/lint-fixtures/check-dist/malformed-html",
    needle: "eof-in-tag",
  },
} as const;

export type ScannerInputKindId = keyof typeof scannerInputKinds;

type AllowedDataScriptType = (typeof scannerInputKinds)["script-json"]["types"][number];

const srcdocDepthLimit = 8;

const srcdocIgnoredParseErrors = new Set<string>(["missing-doctype"]);

function hasScriptType(scan: "script" | "module", type: string): boolean {
  for (const kind of Object.values(scannerInputKinds)) {
    if (kind.group === "script-type" && kind.scan === scan && kind.types.some((entry) => entry === type)) {
      return true;
    }
  }
  return false;
}

function isAllowedDataScriptType(type: string): type is AllowedDataScriptType {
  return scannerInputKinds["script-json"].types.some((allowed) => allowed === type);
}

const extensionLanguage = new Map<string, CommentLanguage>();
for (const kind of Object.values(scannerInputKinds)) {
  if (kind.group === "extension" && "extension" in kind && "language" in kind) {
    extensionLanguage.set(kind.extension, kind.language);
  }
}

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

type JsonKeyScan = "duplicate" | "unique" | "unreadable";

function isJsonRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function scanJsonString(value: string, file: string): Finding[] {
  return scanHtmlFragment(value, file, 0, false);
}

function jsonBoundary(char: string | undefined): boolean {
  return (
    char === undefined ||
    char === " " ||
    char === "\n" ||
    char === "\r" ||
    char === "\t" ||
    char === "," ||
    char === "{" ||
    char === "}" ||
    char === "[" ||
    char === "]"
  );
}

function scanJsonKeys(text: string): JsonKeyScan {
  let index = 0;
  let duplicate = false;
  const escapes: Record<string, string> = {
    '"': '"',
    "\\": "\\",
    "/": "/",
    b: "\b",
    f: "\f",
    n: "\n",
    r: "\r",
    t: "\t",
  };

  function skipWhitespace(): void {
    while (text[index] === " " || text[index] === "\n" || text[index] === "\r" || text[index] === "\t") {
      index += 1;
    }
  }

  function readString(): string | undefined {
    if (text[index] !== '"') return undefined;
    index += 1;
    let value = "";
    while (index < text.length) {
      const char = text[index];
      if (char === '"') {
        index += 1;
        return value;
      }
      if (char === "\\") {
        index += 1;
        const escaped = text[index];
        if (escaped === undefined) return undefined;
        index += 1;
        if (escaped === "u") {
          const hex = text.slice(index, index + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) return undefined;
          value += String.fromCharCode(Number.parseInt(hex, 16));
          index += 4;
          continue;
        }
        const mapped = escapes[escaped];
        if (mapped === undefined) return undefined;
        value += mapped;
        continue;
      }
      if (char === undefined) return undefined;
      value += char;
      index += 1;
    }
    return undefined;
  }

  function skipLiteral(): boolean {
    const start = text[index];
    if (start === "-" || (start !== undefined && start >= "0" && start <= "9")) {
      while (!jsonBoundary(text[index])) index += 1;
      return true;
    }
    if (text.startsWith("true", index)) {
      index += 4;
      return true;
    }
    if (text.startsWith("false", index)) {
      index += 5;
      return true;
    }
    if (text.startsWith("null", index)) {
      index += 4;
      return true;
    }
    return false;
  }

  function parseValue(): boolean {
    skipWhitespace();
    const char = text[index];
    if (char === "{") return parseObject();
    if (char === "[") return parseArray();
    if (char === '"') return readString() !== undefined;
    return skipLiteral();
  }

  function parseArray(): boolean {
    index += 1;
    skipWhitespace();
    if (text[index] === "]") {
      index += 1;
      return true;
    }
    while (index < text.length) {
      if (!parseValue()) return false;
      skipWhitespace();
      if (text[index] === "]") {
        index += 1;
        return true;
      }
      if (text[index] !== ",") return false;
      index += 1;
    }
    return false;
  }

  function parseObject(): boolean {
    index += 1;
    const seen = new Set<string>();
    skipWhitespace();
    if (text[index] === "}") {
      index += 1;
      return true;
    }
    while (index < text.length) {
      skipWhitespace();
      const key = readString();
      if (key === undefined) return false;
      if (seen.has(key)) {
        duplicate = true;
        return true;
      }
      seen.add(key);
      skipWhitespace();
      if (text[index] !== ":") return false;
      index += 1;
      if (!parseValue()) return false;
      skipWhitespace();
      if (text[index] === "}") {
        index += 1;
        return true;
      }
      if (text[index] !== ",") return false;
      index += 1;
    }
    return false;
  }

  const parsed = parseValue();
  skipWhitespace();
  if (duplicate) return "duplicate";
  if (!parsed || index !== text.length) return "unreadable";
  return "unique";
}

function duplicateJsonKeyFindings(text: string, file: string): Finding[] {
  const scan = scanJsonKeys(text);
  if (scan === "unique") return [];
  const reason = scan === "duplicate" ? "duplicate json key" : "unreadable json keys";
  return [{ kind: "parse-error", file, reason }];
}

function scanJsonObject(value: Record<string, unknown>, file: string): Finding[] {
  const findings: Finding[] = [];
  for (const key of Object.keys(value)) {
    findings.push(...scanJsonString(key, file));
    findings.push(...scanJsonValue(value[key], file));
  }
  return findings;
}

function scanJsonValue(value: unknown, file: string): Finding[] {
  if (typeof value === "string") {
    return scanJsonString(value, file);
  }
  if (typeof value === "number" || typeof value === "boolean" || value === null) {
    return [];
  }
  if (Array.isArray(value)) {
    const findings: Finding[] = [];
    for (const item of value) {
      findings.push(...scanJsonValue(item, file));
    }
    return findings;
  }
  if (isJsonRecord(value)) {
    return scanJsonObject(value, file);
  }
  return [{ kind: "parse-error", file, reason: "unsupported json value" }];
}

function scanJsonText(text: string, file: string): Finding[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    return [{ kind: "parse-error", file, reason: errorReason(error) }];
  }
  const findings = duplicateJsonKeyFindings(text, file);
  if (isJsonRecord(parsed)) {
    findings.push(...scanJsonObject(parsed, file));
  } else {
    findings.push(...scanJsonValue(parsed, file));
  }
  return findings;
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

function scriptSource(typeValue: string | undefined): SourceType | "json" | "unknown" {
  const type = typeValue === undefined ? "" : typeValue.trim().toLowerCase();
  if (hasScriptType("module", type)) {
    return "module";
  }
  if (hasScriptType("script", type)) {
    return "script";
  }
  if (isAllowedDataScriptType(type)) {
    return "json";
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

function walk(node: Node, file: string, findings: Finding[], depth = 0) {
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
      } else if (name === "srcdoc") {
        if (depth >= srcdocDepthLimit) {
          findings.push({ kind: "parse-error", file, reason: "srcdoc nested too deep" });
        } else {
          findings.push(...scanHtml(attribute.value, file, depth + 1, srcdocIgnoredParseErrors));
        }
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
      } else if (kind === "json") {
        findings.push(...scanJsonText(code, file));
      } else {
        findings.push(...scanJs(code, file, kind));
      }
    }
    if (node.tagName === "noscript") {
      findings.push(...scanHtmlFragment(elementText(node), file, depth));
    }
  }
  for (const child of children(node)) {
    walk(child, file, findings, depth);
  }
}

function recordParseErrors(
  errors: ParserError["code"][],
  file: string,
  findings: Finding[],
  ignored?: ReadonlySet<string>,
) {
  for (const code of errors) {
    if (ignored?.has(code)) continue;
    findings.push({ kind: "parse-error", file, reason: code });
  }
}

function scanHtmlFragment(html: string, file: string, depth = 0, recordErrors = true): Finding[] {
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
  if (recordErrors) recordParseErrors(errors, file, findings);
  walk(fragment, file, findings, depth);
  return findings;
}

function scanHtml(html: string, file: string, depth = 0, ignored?: ReadonlySet<string>): Finding[] {
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
  recordParseErrors(errors, file, findings, ignored);
  walk(document, file, findings, depth);
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

export function describeScan(root: string): { status: number; text: string } {
  const findings = scanRoot(root);
  return {
    status: findings.length > 0 ? 1 : 0,
    text: findings.map(formatFinding).join("\n"),
  };
}

function main() {
  const root = process.argv[2] ?? "dist";
  const result = describeScan(root);
  if (result.text !== "") {
    console.log(result.text);
  }
  if (result.status !== 0) {
    process.exitCode = 1;
  }
}

const entry = process.argv[1];
if (entry !== undefined && path.resolve(entry) === fileURLToPath(import.meta.url)) {
  main();
}
