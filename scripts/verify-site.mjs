import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");
const htmlPath = path.join(dist, "index.html");
const html = await readFile(htmlPath, "utf8");

if (!html.includes("sample-solid-grey")) {
  console.error("dist/index.html does not list sample-solid-grey");
  process.exit(1);
}

const href = [...html.matchAll(/href="([^"]+)"/g)]
  .map((match) => match[1])
  .find((value) => value.includes("sample-solid-grey") && value.toLowerCase().endsWith(".png"));

if (href === undefined) {
  console.error("dist/index.html has no png download link for sample-solid-grey");
  process.exit(1);
}

const rel = decodeURIComponent(href).replace(/^\/+/, "");
if (rel.includes("..") || path.isAbsolute(rel)) {
  console.error(`download link escapes dist: ${href}`);
  process.exit(1);
}

const file = path.join(dist, rel);
const info = await stat(file);
const disk = await readFile(file);
console.log(`listed sample-solid-grey`);
console.log(`link ${href}`);
console.log(`file ${path.relative(root, file)} ${info.size} bytes`);

const base = process.argv[2];
if (base === undefined) {
  process.exit(0);
}

const url = new URL(href, base.endsWith("/") ? base : `${base}/`);
const response = await fetch(url);
const type = response.headers.get("content-type") ?? "";
const body = Buffer.from(await response.arrayBuffer());
console.log(`GET ${url} ${response.status} ${type} ${body.byteLength} bytes`);
if (response.status !== 200 || !type.includes("image/png")) {
  process.exit(1);
}
if (Buffer.compare(body, disk) !== 0) {
  console.error("response bytes differ from the file in dist");
  process.exit(1);
}
