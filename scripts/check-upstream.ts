import { readFile } from "node:fs/promises";
import { z } from "zod";
import { assetManifestSchema } from "../src/guards/repository.ts";

const manifest = assetManifestSchema.parse(JSON.parse(await readFile("guards/tesla-assets.json", "utf8")));
const response = await fetch("https://api.github.com/repos/teslamotors/custom-wraps/commits/master", { signal: AbortSignal.timeout(30_000) });
if (!response.ok) throw new Error(`upstream check failed with HTTP ${response.status}`);
const upstream = z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/) }).parse(await response.json());
if (upstream.sha !== manifest.revision) throw new Error(`Tesla upstream changed from ${manifest.revision} to ${upstream.sha}; review the requirements and refresh the hash manifest`);
console.log(`upstream: Tesla revision ${upstream.sha} matches the reviewed snapshot`);
