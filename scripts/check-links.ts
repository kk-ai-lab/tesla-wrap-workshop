import fs from "node:fs";
import path from "node:path";
import { parse as parseHtml, type DefaultTreeAdapterMap, type ParserError } from "parse5";
import { VARIANTS, templateUrl, type VariantId } from "../src/domain/variants.ts";

type Node = DefaultTreeAdapterMap["node"];
type ElementNode = DefaultTreeAdapterMap["element"];

export type LinkFinding =
  | { code: "missing-page"; variant: VariantId; file: string }
  | { code: "missing-template-link"; variant: VariantId; file: string }
  | { code: "wrong-template-link"; variant: VariantId; file: string; href: string }
  | { code: "duplicate-template-link"; variant: VariantId; file: string; count: number }
  | { code: "bad-template-link"; file: string; href: string }
  | { code: "tesla-hotlink"; file: string; tag: "a" | "img" | "source"; url: string }
  | { code: "parse-error"; file: string; reason: string };

export type LinkCheckResult =
  | { ok: true; templateLinks: number }
  | { ok: false; findings: LinkFinding[] };

const templateMarker = "data-template-link";
const teslaTemplatePrefix = "https://github.com/teslamotors/custom-wraps/";

function errorReason(error: unknown): string {
  if (error instanceof Error) {
    const line = error.message.split("\n")[0];
    return line === undefined || line.length === 0 ? "parse error" : line;
  }
  return "parse error";
}

function isElement(node: Node): node is ElementNode {
  return "tagName" in node && typeof node.tagName === "string";
}

function children(node: Node): Node[] {
  if ("childNodes" in node) {
    return node.childNodes;
  }
  return [];
}

function walk(node: Node, visit: (element: ElementNode) => void): void {
  if (isElement(node)) {
    visit(node);
  }
  for (const child of children(node)) {
    walk(child, visit);
  }
}

function attribute(element: ElementNode, name: string): string | undefined {
  return element.attrs.find((attr) => attr.name.toLowerCase() === name)?.value;
}

type Parsed = { ok: true; document: Node } | { ok: false; reason: string };

function parseDocument(html: string): Parsed {
  const errors: ParserError["code"][] = [];
  try {
    const document = parseHtml(html, {
      scriptingEnabled: false,
      onParseError(error) {
        errors.push(error.code);
      },
    });
    if (errors.length > 0) {
      return { ok: false, reason: errors[0] ?? "parse error" };
    }
    return { ok: true, document };
  } catch (error) {
    return { ok: false, reason: errorReason(error) };
  }
}

function isHtmlFile(name: string): boolean {
  const extension = path.extname(name).toLowerCase();
  return extension === ".html" || extension === ".htm" || extension === ".xhtml";
}

function listHtml(root: string): string[] {
  const files: string[] = [];
  const visit = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        visit(full);
        continue;
      }
      if (entry.isFile() && isHtmlFile(entry.name)) {
        files.push(path.relative(root, full).split(path.sep).join("/"));
      }
    }
  };
  visit(root);
  return files.sort((left, right) => left.localeCompare(right));
}

const documentOrigin = "https://document.invalid/";

function firstBaseHref(document: Node): string {
  let href = "";
  walk(document, (element) => {
    if (href.length === 0 && element.tagName === "base") {
      href = attribute(element, "href") ?? "";
    }
  });
  return href;
}

function documentBase(document: Node): URL {
  const href = firstBaseHref(document);
  if (href.length === 0) {
    return new URL(documentOrigin);
  }
  try {
    return new URL(href, documentOrigin);
  } catch {
    return new URL(documentOrigin);
  }
}

function isTeslaRawHotlink(value: string, base: URL): boolean {
  let url: URL;
  try {
    url = new URL(value.trim(), base);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return false;
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (host !== "raw.githubusercontent.com") {
    return false;
  }
  const segment = url.pathname.split("/")[1] ?? "";
  let owner = segment;
  try {
    owner = decodeURIComponent(segment);
  } catch {
    owner = segment;
  }
  return owner.toLowerCase() === "teslamotors";
}

function srcsetUrls(value: string): string[] {
  const urls: string[] = [];
  for (const candidate of value.split(",")) {
    const url = candidate.trim().split(/\s+/)[0];
    if (url !== undefined && url.length > 0) {
      urls.push(url);
    }
  }
  return urls;
}

function elementHotlinks(element: ElementNode): { tag: "a" | "img" | "source"; url: string }[] {
  const links: { tag: "a" | "img" | "source"; url: string }[] = [];
  if (element.tagName === "a") {
    const href = attribute(element, "href");
    if (href !== undefined) {
      links.push({ tag: "a", url: href });
    }
  }
  if (element.tagName === "img") {
    const src = attribute(element, "src");
    if (src !== undefined) {
      links.push({ tag: "img", url: src });
    }
  }
  if (element.tagName === "img" || element.tagName === "source") {
    const srcset = attribute(element, "srcset");
    if (srcset !== undefined) {
      for (const url of srcsetUrls(srcset)) {
        links.push({ tag: element.tagName, url });
      }
    }
  }
  return links;
}

function variantFile(variant: VariantId): string {
  return `models/${variant}/index.html`;
}

export function checkLinks(root: string): LinkCheckResult {
  let stats: fs.Stats;
  try {
    stats = fs.statSync(root);
  } catch (error) {
    return { ok: false, findings: [{ code: "parse-error", file: root, reason: errorReason(error) }] };
  }
  if (!stats.isDirectory()) {
    return { ok: false, findings: [{ code: "parse-error", file: root, reason: "not a directory" }] };
  }

  const files = listHtml(root);
  const documents = new Map<string, Node>();
  const parseFindings: LinkFinding[] = [];

  for (const file of files) {
    let source: string;
    try {
      source = fs.readFileSync(path.join(root, file), "utf8");
    } catch (error) {
      parseFindings.push({ code: "parse-error", file, reason: errorReason(error) });
      continue;
    }
    const parsed = parseDocument(source);
    if (!parsed.ok) {
      parseFindings.push({ code: "parse-error", file, reason: parsed.reason });
      continue;
    }
    documents.set(file, parsed.document);
  }

  const variantFindings: LinkFinding[] = [];
  let templateLinks = 0;

  for (const variant of Object.keys(VARIANTS) as VariantId[]) {
    const file = variantFile(variant);
    const document = documents.get(file);
    if (document === undefined) {
      const unreadable = parseFindings.some(
        (finding) => finding.code === "parse-error" && finding.file === file,
      );
      if (!unreadable) {
        variantFindings.push({ code: "missing-page", variant, file });
      }
      continue;
    }
    const links: string[] = [];
    walk(document, (element) => {
      if (element.tagName !== "a") {
        return;
      }
      if (attribute(element, templateMarker) === undefined) {
        return;
      }
      links.push(attribute(element, "href") ?? "");
    });
    if (links.length === 0) {
      variantFindings.push({ code: "missing-template-link", variant, file });
      continue;
    }
    if (links.length > 1) {
      variantFindings.push({
        code: "duplicate-template-link",
        variant,
        file,
        count: links.length,
      });
      continue;
    }
    const href = links[0] ?? "";
    if (href !== templateUrl(variant)) {
      variantFindings.push({ code: "wrong-template-link", variant, file, href });
      continue;
    }
    templateLinks += 1;
  }

  const globalFindings: LinkFinding[] = [];
  for (const file of files) {
    const document = documents.get(file);
    if (document === undefined) {
      continue;
    }
    const base = documentBase(document);
    walk(document, (element) => {
      if (element.tagName === "a" && attribute(element, templateMarker) !== undefined) {
        const href = attribute(element, "href") ?? "";
        if (!href.toLowerCase().startsWith(teslaTemplatePrefix)) {
          globalFindings.push({ code: "bad-template-link", file, href });
        }
      }
      for (const link of elementHotlinks(element)) {
        if (!isTeslaRawHotlink(link.url, base)) {
          continue;
        }
        globalFindings.push({ code: "tesla-hotlink", file, tag: link.tag, url: link.url });
      }
    });
  }

  const findings = [...variantFindings, ...parseFindings, ...globalFindings];
  if (findings.length > 0) {
    return { ok: false, findings };
  }
  return { ok: true, templateLinks };
}
