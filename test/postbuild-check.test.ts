import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { run } from "../scripts/postbuild-check.ts";
import { VARIANTS, templateUrl, type VariantId } from "../src/domain/variants.ts";
import { DISCLAIMER } from "../scripts/check-page-policy.ts";

const variantIds = Object.keys(VARIANTS) as VariantId[];
const successLine = "links: 12 template links ok, 0 tesla hotlinks";

function page(body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>test</title></head><body>${body}<footer><p data-testid="disclaimer">${DISCLAIMER}</p></footer></body></html>`;
}

function anchor(variant: VariantId): string {
  return `<a data-template-link href="${templateUrl(variant)}">Open the Tesla template folder</a>`;
}

async function writePage(root: string, relative: string, body: string): Promise<void> {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, page(body));
}

async function withDist(work: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), "postbuild-check-"));
  try {
    for (const variant of variantIds) {
      await writePage(root, `models/${variant}/index.html`, anchor(variant));
    }
    await writeFile(path.join(root, "robots.txt"), "User-agent: *\nDisallow: /\n");
    await work(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

it("passes with no arguments", async () => {
  await withDist(async (root) => {
    const result = run([], root);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain(successLine);
    expect(result.stdout).toContain("disclaimer: 12/12 pages ok");
    expect(result.stdout).toContain("launch: preview policy checked on 12 pages");
    expect(result.stdout).toContain("assets: no Tesla source copies or denied brand assets");
  });
});

it("passes with --only links and --only=links", async () => {
  await withDist(async (root) => {
    expect(run(["--only", "links"], root).exitCode).toBe(0);
    expect(run(["--only=links"], root).exitCode).toBe(0);
  });
});

it("rejects an unknown only value with exit 2", async () => {
  await withDist(async (root) => {
    const result = run(["--only", "nope"], root);
    expect(result.exitCode).toBe(2);
    expect(result.stdout).toEqual([]);
    expect(result.stderr[0]).toContain("usage:");
  });
});

it("rejects a bare --only with exit 2", async () => {
  await withDist(async (root) => {
    expect(run(["--only"], root).exitCode).toBe(2);
  });
});

it("rejects an unknown flag with exit 2", async () => {
  await withDist(async (root) => {
    expect(run(["--bogus"], root).exitCode).toBe(2);
  });
});

it("exits 1 and names the page when a template link is missing", async () => {
  await withDist(async (root) => {
    await writePage(root, "models/model3/index.html", "<p>No template link here.</p>");
    const result = run([], root);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toEqual([
      "links: models/model3/index.html has no template link for variant model3",
    ]);
  });
});

it("exits 1 and names the page for a tesla hotlink", async () => {
  await withDist(async (root) => {
    const url =
      "https://raw.githubusercontent.com/teslamotors/custom-wraps/master/model3/template.png";
    await writePage(root, "index.html", `<img src="${url}" alt="template">`);
    const result = run(["--only", "links"], root);
    expect(result.exitCode).toBe(1);
    expect(result.stdout).toEqual([`links: index.html img hotlinks ${url}`]);
  });
});
