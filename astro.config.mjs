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
  vite: {
    plugins: [{
      name: "dev-wrap-assets",
      apply: "serve",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          const parts = (req.url ?? "").split("?", 1)[0].split("/");
          const thumbnail = parts.length === 3 && parts[1] === "thumbs";
          const original = parts.length === 4 && parts[1] === "wraps" && parts[3] !== "";
          if (!thumbnail && !original) return next();
          if (req.method !== "GET" && req.method !== "HEAD") {
            res.writeHead(405, { Allow: "GET, HEAD" }).end();
            return;
          }
          try {
            const id = decodeURIComponent(thumbnail ? parts[2].replace(/\.webp$/, "") : parts[2]);
            const file = original ? decodeURIComponent(parts[3]) : undefined;
            if (thumbnail && !parts[2].endsWith(".webp")) {
              res.writeHead(404).end();
              return;
            }
            const root = path.resolve("content/wraps");
            const result = await loadCatalogue(root);
            if (!result.ok) throw new Error("catalogue load failed");
            const wrap = result.catalogue.wraps.find((item) => item.id === id && (!original || item.file === file));
            if (!wrap) {
              res.writeHead(404).end();
              return;
            }
            const bytes = await readFile(path.join(root, wrap.id, wrap.file));
            if (createHash("sha256").update(bytes).digest("hex") !== wrap.sha256) {
              throw new Error(`wrap changed while serving: ${wrap.id}`);
            }
            const body = thumbnail
              ? await sharp(bytes).resize({ width: 512, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer()
              : bytes;
            res.writeHead(200, {
              "Content-Type": thumbnail ? "image/webp" : "image/png",
              "Content-Length": body.length,
              "Cache-Control": "no-store",
            }).end(req.method === "HEAD" ? undefined : body);
          } catch (error) {
            if (error instanceof URIError) {
              res.writeHead(400).end();
              return;
            }
            server.config.logger.error(`Unable to serve wrap asset: ${error}`);
            res.writeHead(500).end();
          }
        });
      },
    }],
  },
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
