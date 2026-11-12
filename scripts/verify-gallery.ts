import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { loadCatalogue } from "../src/catalogue/load.ts";
import { VARIANTS, templateUrl, type VariantId } from "../src/domain/variants.ts";
import type { Wrap } from "../src/domain/wrap.ts";

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

type DownloadLink = { href: string; download: string | undefined };

function downloadLinks(html: string): DownloadLink[] {
  const links: DownloadLink[] = [];
  for (const match of html.matchAll(/<a\b[^>]*>/g)) {
    const tag = match[0] ?? "";
    const href = /\bhref="([^"]*)"/.exec(tag);
    if (href?.[1] === undefined) {
      continue;
    }
    const download = /\sdownload(?:="([^"]*)")?(?=[\s>])/.exec(tag);
    links.push({ href: href[1], download: download?.[1] });
  }
  return links;
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

function expectedDownload(wrap: Wrap): string {
  return path.join("wraps", wrap.id, wrap.file);
}

function findDownload(html: string, wrap: Wrap, label: string): string {
  for (const link of downloadLinks(html)) {
    if (link.download !== wrap.file) {
      continue;
    }
    const rel = distRelative(link.href, wrap.id);
    if (rel === expectedDownload(wrap)) {
      return rel;
    }
  }
  return fail(`${label} has no download link for ${wrap.file} with download="${wrap.file}"`);
}

async function assertSameBytes(wrap: Wrap, target: string): Promise<void> {
  const source = path.resolve("content/wraps", wrap.id, wrap.file);
  const file = path.resolve(dist, target);
  if (file !== dist && !file.startsWith(dist + path.sep)) {
    fail(`wrap ${wrap.id} download link escapes dist: ${target}`);
  }
  let isFile = false;
  try {
    isFile = (await stat(file)).isFile();
  } catch {
    fail(`wrap ${wrap.id} download target is missing: ${target}`);
  }
  if (!isFile) {
    fail(`wrap ${wrap.id} download target is not a file: ${target}`);
  }
  const [sourceBytes, distBytes] = await Promise.all([readFile(source), readFile(file)]);
  if (!sourceBytes.equals(distBytes)) {
    fail(`wrap ${wrap.id} download target differs from ${path.relative(root, source)}`);
  }
}

async function assertThumbnail(wrap: Wrap): Promise<void> {
  const thumb = path.join(dist, "thumbs", `${wrap.id}.webp`);
  let metadata: { format?: string; width?: number; height?: number };
  try {
    metadata = await sharp(thumb).metadata();
  } catch {
    fail(`thumbnail is missing for ${wrap.id} at ${path.relative(root, thumb)}`);
  }
  const width = Math.min(wrap.width, 512);
  const height = Math.round((wrap.height * width) / wrap.width);
  if (metadata.format !== "webp" || metadata.width !== width || metadata.height !== height) {
    fail(
      `thumbnail for ${wrap.id} is ${metadata.format ?? "unknown"} ${metadata.width ?? "?"}x${metadata.height ?? "?"}, want webp ${width}x${height}`,
    );
  }
}

const result = await loadCatalogue(path.resolve("content/wraps"));
if (!result.ok) {
  fail("catalogue load failed");
}
const { wraps } = result.catalogue;

const variantIds = Object.keys(VARIANTS) as VariantId[];
const variantPages = new Map<VariantId, string>();

for (const variant of variantIds) {
  const html = await readText(
    path.join(dist, "models", variant, "index.html"),
    `variant page ${variant}`,
  );
  const template = templateUrl(variant);
  if (!html.includes(template)) {
    fail(`variant page ${variant} does not link to ${template}`);
  }
  variantPages.set(variant, html);
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
  const variantHtml = variantPages.get(wrap.variant);
  if (variantHtml === undefined) {
    fail(`wrap ${wrap.id} has unknown variant ${wrap.variant}`);
  }
  if (!hrefs(variantHtml).includes(`/wraps/${wrap.id}/`)) {
    fail(`variant page ${wrap.variant} does not list wrap ${wrap.id}`);
  }
  if (!indexHrefs.includes(`/wraps/${wrap.id}/`)) {
    fail(`index page does not link to /wraps/${wrap.id}/`);
  }
  const detailHtml = await readText(
    path.join(dist, "wraps", wrap.id, "index.html"),
    `wrap page ${wrap.id}`,
  );
  const target = findDownload(detailHtml, wrap, `wrap page ${wrap.id}`);
  findDownload(variantHtml, wrap, `variant page ${wrap.variant}`);
  findDownload(indexHtml, wrap, "index page");
  await assertSameBytes(wrap, target);
  await assertThumbnail(wrap);
}

for (const variant of variantIds) {
  const page = variantPages.get(variant) ?? "";
  if (!hrefs(page).some((href) => href.startsWith(`/wraps/`))) {
    const empty = "There are no wraps yet for this variant.";
    if (!page.includes(empty)) {
      fail(`empty variant page ${variant} does not show "${empty}"`);
    }
  }
}

const plural = (count: number, one: string, many: string): string =>
  `${count} ${count === 1 ? one : many}`;

console.log(
  `verify-gallery: ${plural(variantIds.length, "variant page", "variant pages")}, ${plural(wraps.length, "wrap page", "wrap pages")}, ${plural(wraps.length, "thumbnail", "thumbnails")}, ${plural(variantIds.length, "index link", "index links")} ok`,
);
