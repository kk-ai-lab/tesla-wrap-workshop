import { lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { parse, type DefaultTreeAdapterMap } from "parse5";

export type HtmlNode = DefaultTreeAdapterMap["node"];
export type HtmlElement = DefaultTreeAdapterMap["element"];
export type BuiltPage = { file: string; bytes: number; document: HtmlNode };
export type BuiltPages = { pages: BuiltPage[]; files: Map<string, Buffer> };

export function isElement(node: HtmlNode): node is HtmlElement {
  return "tagName" in node;
}

export function attr(element: HtmlElement, name: string): string | undefined {
  return element.attrs.find((item) => item.name === name)?.value;
}

export function elements(node: HtmlNode): HtmlElement[] {
  const own = isElement(node) ? [node] : [];
  return "childNodes" in node ? own.concat(node.childNodes.flatMap(elements)) : own;
}

export function visibleText(node: HtmlNode): string {
  if (isElement(node) && (
    ["script", "style", "template", "noscript"].includes(node.tagName) ||
    attr(node, "hidden") !== undefined || attr(node, "aria-hidden") === "true" ||
    /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attr(node, "style") ?? "")
  )) return "";
  if (node.nodeName === "#text" && "value" in node) return node.value;
  return "childNodes" in node ? node.childNodes.map(visibleText).join(" ") : "";
}

export function readBuiltPages(root: string): BuiltPages {
  if (!lstatSync(root).isDirectory()) throw new Error("build output is not a directory");
  const files = new Map<string, Buffer>();
  const pages: BuiltPage[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const file = path.relative(root, full).split(path.sep).join("/");
      if (entry.isSymbolicLink()) throw new Error(`symlink in build output: ${file}`);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.isFile()) throw new Error(`non-regular build output: ${file}`);
      const bytes = readFileSync(full);
      files.set(file, bytes);
      if (!/\.html?$/i.test(file)) continue;
      const errors: string[] = [];
      const document = parse(bytes.toString("utf8"), {
        scriptingEnabled: false,
        onParseError: (error) => errors.push(error.code),
      });
      if (errors.length > 0) throw new Error(`${file}: ${errors[0]}`);
      pages.push({ file, bytes: bytes.length, document });
    }
  };
  walk(root);
  if (pages.length === 0) throw new Error("build output has no HTML pages");
  return { pages: pages.sort((a, b) => a.file.localeCompare(b.file)), files };
}
