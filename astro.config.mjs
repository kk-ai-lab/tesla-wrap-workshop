import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import sharp from "sharp";
import { loadCatalogue } from "./src/catalogue/load.ts";
import { assertReleaseAllowed } from "./scripts/release-gate.ts";

export default defineConfig({
  srcDir: "./src/site",
  output: "static",
  integrations: [
    {
      name: "copy-wrap-pngs",
      hooks: {
        "astro:build:start": () => assertReleaseAllowed(process.cwd(), process.env.PUBLIC_LAUNCH),
        "astro:build:done": async ({ dir }) => {
          const result = await loadCatalogue(path.resolve("content/wraps"));
          if (!result.ok) {
            throw new Error("catalogue load failed");
          }
          const destRoot = fileURLToPath(dir);
          const thumbDir = path.join(destRoot, "thumbs");
          await mkdir(thumbDir, { recursive: true });
          for (const wrap of result.catalogue.wraps) {
            const from = path.resolve("content/wraps", wrap.id, wrap.file);
            const toDir = path.join(destRoot, "wraps", wrap.id);
            await mkdir(toDir, { recursive: true });
            const bytes = await readFile(from);
            if (createHash("sha256").update(bytes).digest("hex") !== wrap.sha256) {
              throw new Error(`wrap changed during build: ${wrap.id}`);
            }
            await writeFile(path.join(toDir, wrap.file), bytes);
            await sharp(bytes)
              .resize({ width: 512, withoutEnlargement: true })
              .webp({ quality: 80 })
              .toFile(path.join(thumbDir, `${wrap.id}.webp`));
          }
        },
      },
    },
  ],
});
