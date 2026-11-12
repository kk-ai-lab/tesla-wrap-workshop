import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadCatalogue } from "../src/catalogue/load.ts";
import { VARIANTS, type VariantId } from "../src/domain/variants.ts";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

function fail(message: string): never {
  console.error(`verify-gallery: ${message}`);
  process.exit(1);
}

async function readText(file: string, label: string): Promise<string> {
  try {
    return await readFile(file, "utf8");
  } catch {
    return fail(`${label} is missing at ${path.relative(root, file)}`);
  }
}

function hrefs(html: string): string[] {
  return [...html.matchAll(/href="([^"]*)"/g)].map((match) => match[1] ?? "");
}

function downloadHrefs(html: string): string[] {
  const found: string[] = [];
  for (const match of html.matchAll(/<a\b[^>]*>/g)) {
    const tag = match[0] ?? "";
    if (!/\bdownload\b/.test(tag)) {
      continue;
    }
    const href = /\bhref="([^"]*)"/.exec(tag);
    if (href?.[1] !== undefined) {
      found.push(href[1]);
    }
  }
  return found;
}

function distRelative(href: string, wrapId: string): string {
  let decoded: string;
  try {
    decoded = decodeURIComponent(href);
  } catch {
    return fail(`wrap ${wrapId} has a download href that is not valid URL encoding: ${href}`);
  }
  const clean = decoded.split("#")[0]?.split("?")[0] ?? "";
  const rel = clean.replace(/^\/+/, "");
  if (rel === "" || rel.includes("..") || path.isAbsolute(rel) || /^[a-z][a-z0-9+.-]*:/i.test(rel)) {
    return fail(`wrap ${wrapId} has a download href that escapes dist: ${href}`);
  }
  return rel;
}

const result = await loadCatalogue(path.resolve("content/wraps"));
if (!result.ok) {
  fail("catalogue load failed");
}
const { wraps } = result.catalogue;

const variantIds = Object.keys(VARIANTS) as VariantId[];
const variantPages = new Map<VariantId, string>();

for (const variant of variantIds) {
  variantPages.set(
    variant,
    await readText(path.join(dist, "models", variant, "index.html"), `variant page ${variant}`),
  );
}

for (const wrap of wraps) {
  const variantHtml = variantPages.get(wrap.variant);
  if (variantHtml === undefined) {
    fail(`wrap ${wrap.id} has unknown variant ${wrap.variant}`);
  }
  if (!hrefs(variantHtml).includes(`/wraps/${wrap.id}/`)) {
    fail(`variant page ${wrap.variant} does not list wrap ${wrap.id}`);
  }
}

for (const wrap of wraps) {
  const page = path.join(dist, "wraps", wrap.id, "index.html");
  const html = await readText(page, `wrap page ${wrap.id}`);
  const candidates = downloadHrefs(html);
  if (candidates.length === 0) {
    fail(`wrap page ${wrap.id} has no download link`);
  }
  let target: string | undefined;
  for (const href of candidates) {
    const rel = distRelative(href, wrap.id);
    if (path.basename(rel) === wrap.file) {
      target = rel;
      break;
    }
  }
  if (target === undefined) {
    fail(`wrap page ${wrap.id} has no download link for ${wrap.file}`);
  }
  const file = path.resolve(dist, target);
  if (file !== dist && !file.startsWith(dist + path.sep)) {
    fail(`wrap page ${wrap.id} download link escapes dist: ${target}`);
  }
  let isFile = false;
  try {
    isFile = (await stat(file)).isFile();
  } catch {
    fail(`wrap page ${wrap.id} download target is missing: ${target}`);
  }
  if (!isFile) {
    fail(`wrap page ${wrap.id} download target is not a file: ${target}`);
  }
}

for (const wrap of wraps) {
  const thumb = path.join(dist, "thumbs", `${wrap.id}.webp`);
  let bytes: Buffer;
  try {
    bytes = await readFile(thumb);
  } catch {
    fail(`thumbnail is missing for ${wrap.id} at ${path.relative(root, thumb)}`);
  }
  if (
    bytes.length < 12 ||
    bytes.toString("latin1", 0, 4) !== "RIFF" ||
    bytes.toString("latin1", 8, 12) !== "WEBP"
  ) {
    fail(`thumbnail for ${wrap.id} is not a WebP file`);
  }
}

const indexHtml = await readText(path.join(dist, "index.html"), "index page");
const indexHrefs = hrefs(indexHtml);
for (const variant of variantIds) {
  const wanted = `/models/${variant}/`;
  if (!indexHrefs.includes(wanted)) {
    fail(`index page does not link to ${wanted}`);
  }
}

for (const wrap of wraps) {
  const wanted = `/wraps/${wrap.id}/`;
  if (!indexHrefs.includes(wanted)) {
    fail(`index page does not link to ${wanted}`);
  }
}

console.log(
  `verify-gallery: ${variantIds.length} variant pages, ${wraps.length} wrap pages, ${wraps.length} thumbnails, ${variantIds.length} index links ok`,
);
