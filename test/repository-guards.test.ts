import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { assetManifestSchema, checkBrand, checkNoRehost, checkRepository, type AssetManifest } from "../src/guards/repository.ts";
import { VARIANTS } from "../src/domain/variants.ts";
import manifest from "../guards/tesla-assets.json";

const source = Buffer.from("synthetic upstream image");
const synthetic: AssetManifest = { ...assetManifestSchema.parse(manifest), assets: [{ path: "model3/example/a.png", sha256: createHash("sha256").update(source).digest("hex"), width: 1024, height: 1024 }] };

it("rejects exact upstream bytes even under an unrelated name", () => {
  expect(checkNoRehost([{ file: "content/own.png", bytes: source }], synthetic)).toEqual([
    { rule: "no-rehost", file: "content/own.png", reason: "matches Tesla model3/example/a.png" },
  ]);
  expect(checkNoRehost([{ file: "own.png", bytes: Buffer.from("original") }], synthetic)).toEqual([]);
});

it.each(["template.png", "TEMPLATE.PNG", "vehicle_image.png"])("rejects reserved asset name %s", (file) => {
  expect(checkNoRehost([{ file: `public/${file}`, bytes: Buffer.from("different bytes") }], synthetic)[0]?.reason).toContain("reserved");
});

it("rejects denied fonts and logo filenames while allowing descriptive Tesla text", () => {
  const policy = { deniedFonts: ["Gotham"], deniedLogoNames: ["tesla-logo"] };
  const results = checkBrand([
    { file: "a.css", bytes: Buffer.from("body{font-family: Gotham, sans-serif}") },
    { file: "custom.woff2", bytes: Buffer.from("font") },
    { file: "tesla-logo.svg", bytes: Buffer.from("<svg/>") },
    { file: "about.html", bytes: Buffer.from("Not affiliated with Tesla. font-family: system-ui") },
  ], policy);
  expect(results.map((finding) => finding.file)).toEqual(["a.css", "custom.woff2", "tesla-logo.svg"]);
});

it("has a measured template for every registered variant", () => {
  expect(manifest.assets).toHaveLength(283);
  for (const [variant, size] of Object.entries(VARIANTS)) {
    expect(manifest.assets.filter((asset) => asset.path === `${variant}/template.png`)).toEqual([
      expect.objectContaining({ width: size.w, height: size.h }),
    ]);
  }
});

it("fails closed for missing manifests and scans nested generated files", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "repo-guard-"));
  try {
    expect(checkRepository(root)[0]?.rule).toBe("files");
    await mkdir(path.join(root, "nested"));
    await writeFile(path.join(root, "nested/TEMPLATE.PNG"), "not a Tesla image");
    expect(checkRepository(process.cwd(), root)).toContainEqual(expect.objectContaining({ rule: "no-rehost", file: "nested/TEMPLATE.PNG" }));
  } finally { await rm(root, { recursive: true, force: true }); }
});
