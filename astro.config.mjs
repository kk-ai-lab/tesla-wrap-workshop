import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "astro/config";
import sharp from "sharp";
import { loadCatalogue } from "./src/catalogue/load.ts";

export default defineConfig({
  srcDir: "./src/site",
  output: "static",
  integrations: [
    {
      name: "copy-wrap-pngs",
      hooks: {
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
            await copyFile(from, path.join(toDir, wrap.file));
            await sharp(from)
              .resize({ width: 512, withoutEnlargement: true })
              .webp({ quality: 80 })
              .toFile(path.join(thumbDir, `${wrap.id}.webp`));
          }
        },
      },
    },
  ],
});
