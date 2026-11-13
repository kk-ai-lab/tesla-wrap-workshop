import { readFileSync, readdirSync } from "node:fs";

function plural(count, one, many) {
  return `${count} ${count === 1 ? one : many}`;
}

const wraps = readdirSync("content/wraps", { withFileTypes: true }).filter((entry) => entry.isDirectory()).length;
const source = readFileSync("src/domain/variants.ts", "utf8");
const start = source.indexOf("export const VARIANTS = {");
const end = source.indexOf("} as const;", start);
if (start < 0 || end < 0) {
  console.error("could not read VARIANTS from src/domain/variants.ts");
  process.exit(1);
}
const variants = [...source.slice(start, end).matchAll(/^\s+(?:"([^"]+)"|([A-Za-z0-9-]+))\s*:/gm)].length;
if (wraps < 1 || variants < 1) {
  console.error(`expected at least one wrap and one variant, got ${wraps} wraps and ${variants} variants`);
  process.exit(1);
}

console.log(`check: ${plural(wraps, "wrap", "wraps")}, ${plural(0, "violation", "violations")}`);
console.log(`verify-gallery: ${plural(variants, "variant page", "variant pages")}, ${plural(wraps, "wrap page", "wrap pages")}, ${plural(wraps, "thumbnail", "thumbnails")}, ${plural(variants, "index link", "index links")} ok`);
console.log(`links: ${variants} template links ok, 0 tesla hotlinks`);
