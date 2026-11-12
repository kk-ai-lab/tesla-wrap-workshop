import { createHash } from "node:crypto";
import { lstat, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { checkPng, readIhdr, SPEC, type Violation } from "../domain/spec";
import { VARIANTS, type VariantId } from "../domain/variants";
import { verifyPngIntegrity } from "./png-integrity";
import { checkProvenance, wrapMetaSchema, type Catalogue, type Wrap } from "../domain/wrap";

function isVariantId(value: string): value is VariantId {
  return Object.prototype.hasOwnProperty.call(VARIANTS, value);
}

export async function loadCatalogue(
  root: string,
): Promise<{ ok: true; catalogue: Catalogue } | { ok: false; violations: (Violation & { wrap: string })[] }> {
  let entries;
  try {
    const rootStat = await lstat(root);
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) throw new Error();
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return { ok: false, violations: [{ code: "schema", path: "root", msg: "missing or invalid content root", wrap: "<root>" }] };
  }
  const folders = entries
    .filter((entry) => (entry.isDirectory() || entry.isSymbolicLink()) && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
  const violations: (Violation & { wrap: string })[] = [];
  const candidates: Wrap[] = [];
  const hashes = new Map<string, string[]>();

  for (const folder of folders) {
    const folderPath = path.join(root, folder);
    const metaPath = path.join(folderPath, "meta.json");
    try {
      const stat = await lstat(folderPath);
      if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error();
    } catch {
      violations.push({ code: "schema", path: "folder", msg: "invalid wrap folder", wrap: folder });
      continue;
    }
    let text: string;
    try {
      const stat = await lstat(metaPath);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error();
      text = await readFile(metaPath, "utf8");
    } catch {
      violations.push({ code: "schema", path: "meta.json", msg: "missing meta.json", wrap: folder });
      continue;
    }
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      violations.push({ code: "schema", path: "meta.json", msg: "invalid JSON", wrap: folder });
      continue;
    }
    const parsed = wrapMetaSchema.safeParse(data);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        violations.push({
          code: "schema",
          path: issue.path.map(String).join("."),
          msg: issue.message,
          wrap: folder,
        });
      }
      continue;
    }
    const meta = parsed.data;
    if (meta.id !== folder) {
      violations.push({ code: "id-mismatch", folder, id: meta.id, wrap: folder });
    }
    const provenanceViolations = checkProvenance(meta.licence, meta.provenance);
    for (const violation of provenanceViolations) {
      violations.push({ ...violation, wrap: folder });
    }
    if (!SPEC.fileName.test(meta.file)) {
      violations.push({ code: "bad-name", name: meta.file, wrap: folder });
      continue;
    }
    let fileBytes: Buffer;
    try {
      const imagePath = path.join(folderPath, meta.file);
      const stat = await lstat(imagePath);
      if (!stat.isFile() || stat.isSymbolicLink()) throw new Error();
      fileBytes = await readFile(imagePath);
    } catch {
      violations.push({ code: "schema", path: "file", msg: "missing file", wrap: folder });
      continue;
    }
    const pngViolations = checkPng(fileBytes, meta.file, meta.variant);
    for (const violation of pngViolations) {
      violations.push({ ...violation, wrap: folder });
    }
    if (pngViolations.length === 0) {
      const { width, height } = readIhdr(fileBytes);
      if (!(await verifyPngIntegrity(fileBytes, width * height))) {
        pngViolations.push({ code: "invalid-png" });
        violations.push({ code: "invalid-png", wrap: folder });
      }
    }
    const sha256 = createHash("sha256").update(fileBytes).digest("hex");
    const group = hashes.get(sha256);
    if (group) {
      group.push(folder);
    } else {
      hashes.set(sha256, [folder]);
    }
    if (meta.id === folder && pngViolations.length === 0 && provenanceViolations.length === 0) {
      const size = readIhdr(fileBytes);
      candidates.push({
        ...meta,
        width: size.width,
        height: size.height,
        bytes: fileBytes.byteLength,
        sha256,
      });
    }
  }

  for (const [sha256, ids] of hashes) {
    if (ids.length < 2) {
      continue;
    }
    const sorted = [...ids].sort();
    for (const folder of ids) {
      violations.push({ code: "dup-sha", sha256, ids: sorted, wrap: folder });
    }
  }

  if (violations.length > 0) {
    return { ok: false, violations };
  }

  candidates.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const byVariant = new Map<VariantId, Wrap[]>();
  for (const key of Object.keys(VARIANTS)) {
    if (!isVariantId(key)) {
      continue;
    }
    byVariant.set(key, []);
  }
  for (const wrap of candidates) {
    const list = byVariant.get(wrap.variant);
    if (list === undefined) {
      throw new Error(`unknown variant ${wrap.variant}`);
    }
    list.push(wrap);
  }
  return { ok: true, catalogue: { wraps: candidates, byVariant } };
}
