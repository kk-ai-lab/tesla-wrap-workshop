import { createHash } from "node:crypto";
import sharp from "sharp";
import { z } from "zod";

const commitSchema = z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/) });
const treeSchema = z.object({
  truncated: z.literal(false),
  tree: z.array(z.object({ path: z.string(), type: z.string(), sha: z.string() })),
});

async function fetchBytes(url: string): Promise<Buffer> {
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
  if (!response.ok) throw new Error(`${response.status} fetching ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

const requested = process.argv[2] ?? "master";
if (!/^[a-zA-Z0-9_-]+$/.test(requested)) throw new Error("expected a commit SHA or branch name");
const api = "https://api.github.com/repos/teslamotors/custom-wraps";
const commit = commitSchema.parse(JSON.parse((await fetchBytes(`${api}/commits/${requested}`)).toString()));
const tree = treeSchema.parse(JSON.parse((await fetchBytes(`${api}/git/trees/${commit.sha}?recursive=1`)).toString()));
const raw = `https://raw.githubusercontent.com/teslamotors/custom-wraps/${commit.sha}`;
const images = tree.tree.filter((entry) => entry.type === "blob" && /\.png$/i.test(entry.path));
if (images.length === 0) throw new Error("upstream inventory has no images");
const assets: { path: string; sha256: string; width: number; height: number }[] = [];
let next = 0;
await Promise.all(Array.from({ length: 6 }, async () => {
  while (next < images.length) {
    const entry = images[next++];
    if (entry === undefined) break;
    const bytes = await fetchBytes(`${raw}/${entry.path.split("/").map(encodeURIComponent).join("/")}`);
    const blobSha = createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
    if (blobSha !== entry.sha) throw new Error(`upstream blob mismatch for ${entry.path}`);
    const info = await sharp(bytes).metadata();
    if (info.width === undefined || info.height === undefined) throw new Error(`no dimensions for ${entry.path}`);
    assets.push({ path: entry.path, sha256: createHash("sha256").update(bytes).digest("hex"), width: info.width, height: info.height });
  }
}));
const readme = await fetchBytes(`${raw}/README.md`);
console.log(JSON.stringify({
  repository: "https://github.com/teslamotors/custom-wraps",
  revision: commit.sha,
  checkedOn: new Date().toISOString().slice(0, 10),
  readmeSha256: createHash("sha256").update(readme).digest("hex"),
  assets: assets.sort((a, b) => a.path.localeCompare(b.path)),
}, null, 2));
