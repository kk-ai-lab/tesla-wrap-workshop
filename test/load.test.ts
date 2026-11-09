import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { loadCatalogue } from "../src/catalogue/load.ts";

const validPng = path.resolve("test/fixtures/valid.png");

const variantIds = [
  "cybertruck",
  "model3",
  "model3-2024-base",
  "model3-2024-performance",
  "modely",
  "modely-2025-base",
  "modely-2025-premium",
  "modely-2025-performance",
  "modely-l",
  "models-2021",
  "models-2025-plaid",
  "modelx-2021",
] as const;

const thirdParty = {
  kind: "third-party",
  author: "Ada Lovelace",
  sourceUrl: "https://example.com/wrap",
  sourceLicenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
  retrievedOn: "2026-11-09",
};

function meta(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    title: "Solid Grey",
    variant: "model3",
    file: "wrap.png",
    licence: "CC0-1.0",
    provenance: [{ kind: "own", author: "kk-ai-lab" }],
    tags: ["sample"],
    addedOn: "2026-11-09",
    ...overrides,
  };
}

async function withRoot(run: (root: string) => Promise<void>) {
  const root = await mkdtemp(path.join(tmpdir(), "wraps-"));
  try {
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

async function writeWrap(
  root: string,
  folder: string,
  options: { meta?: unknown; png?: boolean; fileName?: string },
) {
  const dir = path.join(root, folder);
  await mkdir(dir, { recursive: true });
  if ("meta" in options) {
    await writeFile(path.join(dir, "meta.json"), JSON.stringify(options.meta));
  }
  if (options.png) {
    await cp(validPng, path.join(dir, options.fileName ?? "wrap.png"));
  }
}

it("reports a schema violation when meta.json is missing", async () => {
  await withRoot(async (root) => {
    await mkdir(path.join(root, "missing-meta"));
    const result = await loadCatalogue(root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations).toEqual([
        expect.objectContaining({
          code: "schema",
          path: "meta.json",
          wrap: "missing-meta",
        }),
      ]);
    }
  });
});

it("reports id-mismatch when the id does not match the folder", async () => {
  await withRoot(async (root) => {
    await writeWrap(root, "folder-a", { meta: meta("other-id"), png: true });
    const result = await loadCatalogue(root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations).toEqual([
        {
          code: "id-mismatch",
          folder: "folder-a",
          id: "other-id",
          wrap: "folder-a",
        },
      ]);
    }
  });
});

it("reports a schema violation for an unknown variant", async () => {
  await withRoot(async (root) => {
    await writeWrap(root, "bad-variant", {
      meta: meta("bad-variant", { variant: "roadster" }),
      png: true,
    });
    const result = await loadCatalogue(root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.violations.some(
          (violation) =>
            violation.code === "schema" &&
            violation.path === "variant" &&
            violation.wrap === "bad-variant",
        ),
      ).toBe(true);
    }
  });
});

it("reports a schema violation when the png is missing", async () => {
  await withRoot(async (root) => {
    await writeWrap(root, "no-file", { meta: meta("no-file", { file: "missing.png" }) });
    const result = await loadCatalogue(root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations).toEqual([
        expect.objectContaining({ code: "schema", path: "file", wrap: "no-file" }),
      ]);
    }
  });
});

it("rejects width stored in meta.json", async () => {
  await withRoot(async (root) => {
    await writeWrap(root, "has-width", {
      meta: meta("has-width", { width: 1024 }),
      png: true,
    });
    const result = await loadCatalogue(root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.length).toBeGreaterThan(0);
      expect(result.violations.every((violation) => violation.code === "schema")).toBe(true);
      const text = result.violations
        .map((violation) => (violation.code === "schema" ? `${violation.path} ${violation.msg}` : violation.code))
        .join("\n");
      expect(text).toMatch(/width/);
    }
  });
});

it("rejects own provenance with no author", async () => {
  await withRoot(async (root) => {
    await writeWrap(root, "own-no-author", {
      meta: meta("own-no-author", { provenance: [{ kind: "own" }] }),
      png: true,
    });
    const result = await loadCatalogue(root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.violations.some(
          (violation) =>
            violation.code === "schema" &&
            violation.path === "provenance.0.author" &&
            violation.wrap === "own-no-author",
        ),
      ).toBe(true);
    }
  });
});

it("accepts CC-BY-4.0 with own provenance", async () => {
  await withRoot(async (root) => {
    await writeWrap(root, "by-own", {
      meta: meta("by-own", {
        licence: "CC-BY-4.0",
        provenance: [{ kind: "own", author: "kk-ai-lab" }],
      }),
      png: true,
    });
    const result = await loadCatalogue(root);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.catalogue.wraps.map((wrap) => wrap.id)).toEqual(["by-own"]);
    }
  });
});

it("rejects CC-BY-4.0 third-party provenance", async () => {
  await withRoot(async (root) => {
    await writeWrap(root, "by-third", {
      meta: meta("by-third", { licence: "CC-BY-4.0", provenance: [thirdParty] }),
      png: true,
    });
    const result = await loadCatalogue(root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations).toEqual([
        {
          code: "licence-provenance",
          licence: "CC-BY-4.0",
          kind: "third-party",
          wrap: "by-third",
        },
      ]);
    }
  });
});

it("loads CC0 own provenance from the png bytes", async () => {
  await withRoot(async (root) => {
    await writeWrap(root, "cc0-own", { meta: meta("cc0-own"), png: true });
    const result = await loadCatalogue(root);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const file = await readFile(validPng);
    const sha256 = createHash("sha256").update(file).digest("hex");
    expect(result.catalogue.wraps).toEqual([
      expect.objectContaining({
        id: "cc0-own",
        width: 1024,
        height: 1024,
        bytes: file.byteLength,
        sha256,
      }),
    ]);
    for (const variantId of variantIds) {
      expect(result.catalogue.byVariant.has(variantId)).toBe(true);
    }
    expect(result.catalogue.byVariant.get("model3")?.map((wrap) => wrap.id)).toEqual(["cc0-own"]);
    expect(result.catalogue.byVariant.get("cybertruck")).toEqual([]);
  });
});

it("rejects CC0 third-party provenance that omits sourceUrl", async () => {
  const incomplete = {
    kind: "third-party",
    author: "Ada Lovelace",
    sourceLicenceUrl: "https://creativecommons.org/publicdomain/zero/1.0/",
    retrievedOn: "2026-11-09",
  };
  await withRoot(async (root) => {
    await writeWrap(root, "cc0-missing", {
      meta: meta("cc0-missing", { provenance: [incomplete] }),
      png: true,
    });
    const result = await loadCatalogue(root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations).toEqual([
        {
          code: "licence-provenance",
          licence: "CC0-1.0",
          kind: "third-party",
          wrap: "cc0-missing",
        },
      ]);
    }
  });
});

it("rejects CC0 third-party provenance with a blank author", async () => {
  await withRoot(async (root) => {
    await writeWrap(root, "cc0-blank", {
      meta: meta("cc0-blank", { provenance: [{ ...thirdParty, author: " " }] }),
      png: true,
    });
    const result = await loadCatalogue(root);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations).toEqual([
        {
          code: "licence-provenance",
          licence: "CC0-1.0",
          kind: "third-party",
          wrap: "cc0-blank",
        },
      ]);
    }
  });
});

it("accepts complete CC0 third-party provenance", async () => {
  await withRoot(async (root) => {
    await writeWrap(root, "cc0-third", {
      meta: meta("cc0-third", { provenance: [thirdParty] }),
      png: true,
    });
    const result = await loadCatalogue(root);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.catalogue.wraps.map((wrap) => wrap.id)).toEqual(["cc0-third"]);
    }
  });
});

it("rejects two wraps that share a sha256", async () => {
  await withRoot(async (root) => {
    await writeWrap(root, "alpha", { meta: meta("alpha"), png: true });
    await writeWrap(root, "beta", { meta: meta("beta"), png: true });
    const result = await loadCatalogue(root);
    expect(result.ok).toBe(false);
    if (result.ok) {
      return;
    }
    const file = await readFile(validPng);
    const sha256 = createHash("sha256").update(file).digest("hex");
    const dups = result.violations.filter(
      (violation): violation is typeof violation & { code: "dup-sha" } => violation.code === "dup-sha",
    );
    expect(result.violations.every((violation) => violation.code === "dup-sha")).toBe(true);
    expect(dups).toHaveLength(2);
    expect(dups.map((violation) => violation.wrap).sort()).toEqual(["alpha", "beta"]);
    for (const dup of dups) {
      expect(dup.sha256).toBe(sha256);
      expect(dup.ids).toEqual(["alpha", "beta"]);
    }
  });
});
