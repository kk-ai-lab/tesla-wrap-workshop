import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { z } from "zod";
import { VARIANTS } from "../domain/variants.ts";

export const assetManifestSchema = z.object({
  repository: z.literal("https://github.com/teslamotors/custom-wraps"),
  revision: z.string().regex(/^[a-f0-9]{40}$/),
  checkedOn: z.string().date(),
  readmeSha256: z.string().regex(/^[a-f0-9]{64}$/),
  assets: z.array(z.object({
    path: z.string().min(1),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
    width: z.number().int().positive(),
    height: z.number().int().positive(),
  })).min(1),
});

const brandSchema = z.object({
  deniedFonts: z.array(z.string().min(1)).min(1),
  deniedLogoNames: z.array(z.string().min(1)).min(1),
});

export type NamedBytes = { file: string; bytes: Uint8Array };
export type GuardFinding = { rule: "no-rehost" | "brand" | "files"; file: string; reason: string };
export type AssetManifest = z.infer<typeof assetManifestSchema>;
type BrandPolicy = z.infer<typeof brandSchema>;

export function checkNoRehost(files: readonly NamedBytes[], manifest: AssetManifest): GuardFinding[] {
  const hashes = new Map(manifest.assets.map((asset) => [asset.sha256, asset.path]));
  const findings: GuardFinding[] = [];
  for (const { file, bytes } of files) {
    const source = hashes.get(createHash("sha256").update(bytes).digest("hex"));
    if (source !== undefined) findings.push({ rule: "no-rehost", file, reason: `matches Tesla ${source}` });
    else if (/^(template|vehicle_image)\.png$/i.test(path.basename(file))) {
      findings.push({ rule: "no-rehost", file, reason: "reserved Tesla asset filename" });
    }
  }
  return findings;
}

export function checkBrand(files: readonly NamedBytes[], policy: BrandPolicy): GuardFinding[] {
  const findings: GuardFinding[] = [];
  for (const { file, bytes } of files) {
    if (/\.(woff2?|ttf|otf|eot)$/i.test(file)) findings.push({ rule: "brand", file, reason: "bundled fonts are not allowed; use system fonts" });
    const name = path.basename(file).toLowerCase();
    if (policy.deniedLogoNames.some((word) => name.includes(word))) {
      findings.push({ rule: "brand", file, reason: "Tesla logo asset filename" });
    }
    if (!/\.(astro|css|html|svg|[cm]?js|tsx?)$/i.test(file)) continue;
    const text = Buffer.from(bytes).toString("utf8");
    for (const declaration of text.matchAll(/font-family\s*[:=]\s*([^;}\n]+)/gi)) {
      const value = declaration[1]?.toLowerCase() ?? "";
      for (const font of policy.deniedFonts) {
        if (value.includes(font.toLowerCase())) findings.push({ rule: "brand", file, reason: `font ${font} denied` });
      }
    }
  }
  return findings;
}

function collect(root: string, names: readonly string[]): { files: NamedBytes[]; findings: GuardFinding[] } {
  const files: NamedBytes[] = [];
  const findings: GuardFinding[] = [];
  for (const name of names) {
    try {
      const full = path.join(root, name);
      if (!lstatSync(full).isFile()) {
        findings.push({ rule: "files", file: name, reason: "expected a regular file" });
        continue;
      }
      files.push({ file: name, bytes: readFileSync(full) });
    } catch {
      findings.push({ rule: "files", file: name, reason: "cannot read file" });
    }
  }
  return { files, findings };
}

export function checkRepository(root: string, dist?: string): GuardFinding[] {
  try {
    const manifest = assetManifestSchema.parse(JSON.parse(readFileSync(path.join(root, "guards/tesla-assets.json"), "utf8")));
    const policy = brandSchema.parse(JSON.parse(readFileSync(path.join(root, "guards/brand-denylist.json"), "utf8")));
    for (const [variant, size] of Object.entries(VARIANTS)) {
      const templates = manifest.assets.filter((asset) => asset.path === `${variant}/template.png`);
      if (templates.length !== 1 || templates[0]?.width !== size.w || templates[0]?.height !== size.h) {
        throw new Error(`upstream manifest template does not match variant ${variant}`);
      }
    }
    let names: string[];
    if (dist === undefined) {
      names = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" })
        .split("\0").filter(Boolean).filter((file) => !file.startsWith(".audit/"));
    } else {
      names = [];
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) walk(full);
          else names.push(path.relative(dist, full));
        }
      };
      walk(dist);
    }
    const inventory = collect(dist ?? root, [...new Set(names)].sort());
    const brandFiles = dist === undefined ? inventory.files.filter((item) => /^(src|public)\//.test(item.file)) : inventory.files;
    return [...inventory.findings, ...checkNoRehost(inventory.files, manifest), ...checkBrand(brandFiles, policy)];
  } catch (error) {
    return [{ rule: "files", file: dist ?? root, reason: error instanceof Error ? error.message : "repository guard failed" }];
  }
}
