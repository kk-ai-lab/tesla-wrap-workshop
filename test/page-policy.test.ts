import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { BUDGET, DISCLAIMER, checkPagePolicy, type PageCheck } from "../scripts/check-page-policy.ts";
import { assertReleaseAllowed } from "../scripts/release-gate.ts";
import { launchMode } from "../src/domain/launch.ts";
import { loadCatalogue } from "../src/catalogue/load.ts";
import { renderLegalCatalogue } from "../scripts/legal-packet.ts";

function page(body = "", head = '<meta name="robots" content="noindex,nofollow">'): string {
  return `<!doctype html><html lang="en"><head><title>Test</title>${head}</head><body>${body}<footer><p data-testid="disclaimer">${DISCLAIMER}</p></footer></body></html>`;
}

async function withSite(work: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), "page-policy-"));
  try {
    await writeFile(path.join(root, "index.html"), page());
    await writeFile(path.join(root, "robots.txt"), "User-agent: *\nDisallow: /\n");
    await work(root);
  } finally { await rm(root, { force: true, recursive: true }); }
}

it("checks every valid page and fails closed for an absent or empty build", async () => {
  await withSite(async (root) => {
    expect(checkPagePolicy(root, undefined, "preview").findings).toEqual([]);
    for (const only of ["disclaimer", "budget", "launch"] satisfies PageCheck[]) {
      expect(checkPagePolicy(path.join(root, "missing"), only, "preview").findings.length).toBeGreaterThan(0);
    }
    await rm(path.join(root, "index.html"));
    expect(checkPagePolicy(root, undefined, "preview").findings).toContain("pages: build output has no HTML pages");
  });
});

it.each([
  "",
  `<footer><p data-testid="disclaimer">Not affiliated with Tesla</p></footer>`,
  `<footer hidden><p data-testid="disclaimer">${DISCLAIMER}</p></footer>`,
  `<footer><p hidden data-testid="disclaimer">${DISCLAIMER}</p></footer>`,
  `<footer><p aria-hidden="true" data-testid="disclaimer">${DISCLAIMER}</p></footer>`,
  `<noscript><footer><p data-testid="disclaimer">${DISCLAIMER}</p></footer></noscript>`,
  `<template><footer><p data-testid="disclaimer">${DISCLAIMER}</p></footer></template>`,
  `<p data-testid="disclaimer">${DISCLAIMER}</p>`,
])("rejects missing, shortened, hidden or inert disclaimers %#", async (footer) => {
  await withSite(async (root) => {
    const html = page().replace(/<footer>.*<\/footer>/, footer);
    await writeFile(path.join(root, "index.html"), html);
    expect(checkPagePolicy(root, "disclaimer", "preview").findings).toContainEqual(expect.stringContaining("index.html must have one visible footer disclaimer"));
  });
});

it("names an additional page with no disclaimer and rejects parse errors", async () => {
  await withSite(async (root) => {
    await writeFile(path.join(root, "extra.html"), page().replace(DISCLAIMER, ""));
    expect(checkPagePolicy(root, "disclaimer", "preview").findings[0]).toContain("extra.html");
    await writeFile(path.join(root, "extra.html"), "<html><body>Missing doctype");
    expect(checkPagePolicy(root, "disclaimer", "preview").findings[0]).toContain("missing-doctype");
  });
});

it("accepts HTML at the byte budget and rejects one byte over", async () => {
  await withSite(async (root) => {
    const empty = page();
    const exact = empty.replace("</body>", " ".repeat(BUDGET.html - Buffer.byteLength(empty)) + "</body>");
    await writeFile(path.join(root, "index.html"), exact);
    expect(checkPagePolicy(root, "budget", "preview").findings).toEqual([]);
    await writeFile(path.join(root, "index.html"), exact + " ");
    expect(checkPagePolicy(root, "budget", "preview").findings[0]).toContain("50001 exceeds 50000");
  });
});

it("counts emitted and inline JavaScript against the total budget", async () => {
  await withSite(async (root) => {
    await writeFile(path.join(root, "main.mjs"), " ".repeat(BUDGET.js));
    expect(checkPagePolicy(root, "budget", "preview").findings).toEqual([]);
    await writeFile(path.join(root, "index.html"), page("<script>1</script>"));
    expect(checkPagePolicy(root, "budget", "preview").findings).toContain("budget: JavaScript 20001 exceeds 20000 bytes");
  });
});

it("counts unique image candidates per page and checks their existence", async () => {
  await withSite(async (root) => {
    await writeFile(path.join(root, "thumb.webp"), Buffer.alloc(BUDGET.thumbnails));
    await writeFile(path.join(root, "index.html"), page('<img src="thumb.webp" alt="test"><img src="thumb.webp" alt="same">'));
    expect(checkPagePolicy(root, "budget", "preview").findings).toEqual([]);
    await writeFile(path.join(root, "other.webp"), Buffer.alloc(1));
    await writeFile(path.join(root, "index.html"), page('<img srcset="thumb.webp 1x, other.webp 2x" alt="test">'));
    expect(checkPagePolicy(root, "budget", "preview").findings[0]).toContain("600001 exceed 600000");
    await rm(path.join(root, "other.webp"));
    expect(checkPagePolicy(root, "budget", "preview").findings[0]).toContain("missing thumbnail other.webp");
  });
});

it("rejects unmetered remote images and encoded path escapes", async () => {
  await withSite(async (root) => {
    for (const src of ["https://example.com/a.webp", "/%2e%2e%2fprivate.webp"]) {
      await writeFile(path.join(root, "index.html"), page(`<img src="${src}" alt="test">`));
      expect(checkPagePolicy(root, "budget", "preview").findings.length).toBeGreaterThan(0);
    }
  });
});

it("requires preview meta and robots and checks public output in reverse", async () => {
  await withSite(async (root) => {
    await writeFile(path.join(root, "index.html"), page("", ""));
    expect(checkPagePolicy(root, "launch", "preview").findings[0]).toContain("index.html");
    await writeFile(path.join(root, "robots.txt"), "User-agent: *\nAllow: /\n");
    expect(checkPagePolicy(root, "launch", "public").findings).toEqual([]);
    await writeFile(path.join(root, "index.html"), page());
    expect(checkPagePolicy(root, "launch", "public").findings[0]).toContain("blocks public indexing");
    expect(checkPagePolicy(root, "launch", "preview").findings[0]).toContain("robots.txt");
  });
});

it("defaults to preview and blocks public builds without recorded sign-off", async () => {
  expect(launchMode(undefined)).toBe("preview");
  expect(launchMode("false")).toBe("preview");
  expect(launchMode("true")).toBe("public");
  for (const value of ["", "TRUE", "yes", "0"]) expect(() => launchMode(value)).toThrow();
  await withSite(async (root) => {
    await expect(assertReleaseAllowed(root, undefined)).resolves.toBeUndefined();
    await mkdir(path.join(root, "docs"));
    await writeFile(path.join(root, "docs/legal-review.md"), "LEGAL_SIGNOFF:\n");
    await expect(assertReleaseAllowed(root, "true")).rejects.toThrow("public build blocked");
    await cp(path.resolve("content"), path.join(root, "content"), { recursive: true });
    const catalogue = await loadCatalogue(path.join(root, "content/wraps"));
    if (!catalogue.ok) throw new Error("test catalogue must load");
    const inventory = renderLegalCatalogue(catalogue.catalogue);
    const hash = createHash("sha256").update(inventory).digest("hex");
    const signoff = `LEGAL_SIGNOFF: Kai, 2026-11-12\nLEGAL_CATALOGUE_SHA256: ${hash}\n`;
    await writeFile(path.join(root, "docs/legal-review.md"), signoff);
    await writeFile(path.join(root, "docs/legal-catalogue.md"), inventory);
    await expect(assertReleaseAllowed(root, "true")).resolves.toBeUndefined();
    const changed = { ...catalogue.catalogue, wraps: catalogue.catalogue.wraps.map((wrap) => ({ ...wrap, title: "Changed design" })) };
    await writeFile(path.join(root, "docs/legal-catalogue.md"), renderLegalCatalogue(changed));
    await expect(assertReleaseAllowed(root, "true")).rejects.toThrow("catalogue differs");
    await writeFile(path.join(root, "docs/legal-catalogue.md"), inventory);
    const wrap = catalogue.catalogue.wraps[0];
    if (wrap === undefined) throw new Error("sample required");
    const meta = JSON.parse(await readFile(path.join(root, "content/wraps", wrap.id, "meta.json"), "utf8"));
    await writeFile(path.join(root, "content/wraps", wrap.id, "meta.json"), JSON.stringify({ ...meta, title: "New reviewed content required" }));
    await expect(assertReleaseAllowed(root, "true")).rejects.toThrow("catalogue differs");
  });
});

const CATALOGUE_DIFFERS = "public build blocked: catalogue differs from the inventory approved by Kai";
const SIGN_OFF_REQUIRED = "public build blocked: Kai must record legal sign-off in docs/legal-review.md";

async function withReleaseCatalogue(work: (root: string, inventory: string, hash: string) => Promise<void>): Promise<void> {
  await withSite(async (root) => {
    const wraps = path.join(root, "content/wraps/grey-sample");
    await mkdir(wraps, { recursive: true });
    await writeFile(path.join(wraps, "meta.json"), JSON.stringify({
      id: "grey-sample",
      title: "Solid Grey",
      variant: "model3",
      file: "wrap.png",
      licence: "CC0-1.0",
      provenance: [{ kind: "own", author: "kk-ai-lab" }],
      tags: ["sample"],
      addedOn: "2026-11-09",
    }));
    await cp(path.resolve("test/fixtures/valid.png"), path.join(wraps, "wrap.png"));
    await mkdir(path.join(root, "docs"), { recursive: true });
    const loaded = await loadCatalogue(path.join(root, "content/wraps"));
    if (!loaded.ok) throw new Error("release-gate fixture must load");
    const inventory = renderLegalCatalogue(loaded.catalogue);
    const hash = createHash("sha256").update(inventory).digest("hex");
    await work(root, inventory, hash);
  });
}

it("blocks a public build when the approved catalogue hash is missing", async () => {
  await withReleaseCatalogue(async (root, inventory) => {
    await writeFile(path.join(root, "docs/legal-catalogue.md"), inventory);
    await writeFile(path.join(root, "docs/legal-review.md"), "LEGAL_SIGNOFF: Kai, 2026-11-12\n");
    await expect(assertReleaseAllowed(root, "true")).rejects.toThrow(CATALOGUE_DIFFERS);
  });
});

it("blocks a public build when the inventory was regenerated but the approved hash is old", async () => {
  await withReleaseCatalogue(async (root, inventory, hash) => {
    const metaPath = path.join(root, "content/wraps/grey-sample/meta.json");
    const meta = JSON.parse(await readFile(metaPath, "utf8")) as { title: string };
    await writeFile(metaPath, JSON.stringify({ ...meta, title: "Reviewed again" }));
    const reloaded = await loadCatalogue(path.join(root, "content/wraps"));
    if (!reloaded.ok) throw new Error("regenerated catalogue must load");
    const regenerated = renderLegalCatalogue(reloaded.catalogue);
    if (regenerated === inventory) throw new Error("fixture must change the inventory");
    await writeFile(path.join(root, "docs/legal-catalogue.md"), regenerated);
    await writeFile(path.join(root, "docs/legal-review.md"), `LEGAL_SIGNOFF: Kai, 2026-11-12\nLEGAL_CATALOGUE_SHA256: ${hash}\n`);
    await expect(assertReleaseAllowed(root, "true")).rejects.toThrow(CATALOGUE_DIFFERS);
  });
});

it("blocks a public build when legal sign-off is empty and the catalogue hash is current", async () => {
  await withReleaseCatalogue(async (root, inventory, hash) => {
    await writeFile(path.join(root, "docs/legal-catalogue.md"), inventory);
    await writeFile(path.join(root, "docs/legal-review.md"), `LEGAL_SIGNOFF:\nLEGAL_CATALOGUE_SHA256: ${hash}\n`);
    await expect(assertReleaseAllowed(root, "true")).rejects.toThrow(SIGN_OFF_REQUIRED);
  });
});
