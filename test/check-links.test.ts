import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { expect, it } from "vitest";
import { checkLinks } from "../scripts/check-links.ts";
import { VARIANTS, templateUrl, type VariantId } from "../src/domain/variants.ts";

const variantIds = Object.keys(VARIANTS) as VariantId[];

function page(body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>test</title></head><body>${body}</body></html>`;
}

function templateAnchor(variant: VariantId): string {
  return `<a data-template-link href="${templateUrl(variant)}">Open the Tesla template folder</a>`;
}

async function writePage(root: string, relative: string, body: string): Promise<void> {
  const file = path.join(root, relative);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, page(body));
}

async function withDist(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(tmpdir(), "check-links-"));
  try {
    for (const variant of variantIds) {
      await writePage(root, `models/${variant}/index.html`, templateAnchor(variant));
    }
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

it("accepts 12 variant pages with one correct template link", async () => {
  await withDist(async (root) => {
    expect(checkLinks(root)).toEqual({ ok: true, templateLinks: 12 });
  });
});

it("reports a missing variant page", async () => {
  await withDist(async (root) => {
    await rm(path.join(root, "models", "model3"), { recursive: true, force: true });
    expect(checkLinks(root)).toEqual({
      ok: false,
      findings: [
        {
          code: "missing-page",
          variant: "model3",
          file: "models/model3/index.html",
        },
      ],
    });
  });
});

it("reports a variant page with no template link", async () => {
  await withDist(async (root) => {
    await writePage(root, "models/model3/index.html", "<p>No template link here.</p>");
    expect(checkLinks(root)).toEqual({
      ok: false,
      findings: [
        {
          code: "missing-template-link",
          variant: "model3",
          file: "models/model3/index.html",
        },
      ],
    });
  });
});

it("reports a template link pointing at another variant", async () => {
  await withDist(async (root) => {
    await writePage(root, "models/model3/index.html", templateAnchor("modely"));
    expect(checkLinks(root)).toEqual({
      ok: false,
      findings: [
        {
          code: "wrong-template-link",
          variant: "model3",
          file: "models/model3/index.html",
          href: templateUrl("modely"),
        },
      ],
    });
  });
});

it("reports a duplicated template link", async () => {
  await withDist(async (root) => {
    await writePage(
      root,
      "models/model3/index.html",
      `${templateAnchor("model3")}${templateAnchor("model3")}`,
    );
    expect(checkLinks(root)).toEqual({
      ok: false,
      findings: [
        {
          code: "duplicate-template-link",
          variant: "model3",
          file: "models/model3/index.html",
          count: 2,
        },
      ],
    });
  });
});

it("reports an https tesla raw hotlink on an img", async () => {
  await withDist(async (root) => {
    const url =
      "https://raw.githubusercontent.com/teslamotors/custom-wraps/master/model3/template.png";
    await writePage(root, "index.html", `<img src="${url}" alt="template">`);
    expect(checkLinks(root)).toEqual({
      ok: false,
      findings: [{ code: "tesla-hotlink", file: "index.html", tag: "img", url }],
    });
  });
});

it("reports a protocol-relative tesla raw hotlink on an anchor", async () => {
  await withDist(async (root) => {
    const url =
      "//raw.githubusercontent.com/teslamotors/custom-wraps/master/model3/template.png";
    await writePage(root, "index.html", `<a href="${url}">template</a>`);
    expect(checkLinks(root)).toEqual({
      ok: false,
      findings: [{ code: "tesla-hotlink", file: "index.html", tag: "a", url }],
    });
  });
});

it("reports an http tesla raw hotlink on an anchor", async () => {
  await withDist(async (root) => {
    const url =
      "http://raw.githubusercontent.com/teslamotors/custom-wraps/master/model3/template.png";
    await writePage(root, "index.html", `<a href="${url}">template</a>`);
    expect(checkLinks(root)).toEqual({
      ok: false,
      findings: [{ code: "tesla-hotlink", file: "index.html", tag: "a", url }],
    });
  });
});

it("allows a github template folder link and a relative link", async () => {
  await withDist(async (root) => {
    const allowed = "https://github.com/teslamotors/custom-wraps/tree/master/model3";
    await writePage(
      root,
      "index.html",
      `<a href="${allowed}">templates</a><a href="/models/modely/">model y</a><img src="/thumbs/example.webp" alt="thumb">`,
    );
    expect(checkLinks(root)).toEqual({ ok: true, templateLinks: 12 });
  });
});

it("reports a template marker outside the Tesla repo", async () => {
  await withDist(async (root) => {
    const href = "https://example.com/templates";
    await writePage(root, "index.html", `<a data-template-link href="${href}">templates</a>`);
    expect(checkLinks(root)).toEqual({
      ok: false,
      findings: [{ code: "bad-template-link", file: "index.html", href }],
    });
  });
});

it("allows a template marker outside a model page when it points at the Tesla repo", async () => {
  await withDist(async (root) => {
    await writePage(root, "index.html", templateAnchor("model3"));
    expect(checkLinks(root)).toEqual({ ok: true, templateLinks: 12 });
  });
});

it("reports a tesla raw hotlink in an img srcset", async () => {
  await withDist(async (root) => {
    const url =
      "https://raw.githubusercontent.com/teslamotors/custom-wraps/master/model3/template.png";
    await writePage(
      root,
      "index.html",
      `<img src="/thumbs/example.webp" srcset="/thumbs/example.webp 1x, ${url} 2x" alt="template">`,
    );
    expect(checkLinks(root)).toEqual({
      ok: false,
      findings: [{ code: "tesla-hotlink", file: "index.html", tag: "img", url }],
    });
  });
});

it("reports a tesla raw hotlink in a picture source srcset", async () => {
  await withDist(async (root) => {
    const url =
      "//raw.githubusercontent.com/teslamotors/custom-wraps/master/model3/template.png";
    await writePage(
      root,
      "index.html",
      `<picture><source srcset="${url}" type="image/png"><img src="/thumbs/example.webp" alt="template"></picture>`,
    );
    expect(checkLinks(root)).toEqual({
      ok: false,
      findings: [{ code: "tesla-hotlink", file: "index.html", tag: "source", url }],
    });
  });
});

it("reports a tesla raw hotlink inside noscript", async () => {
  await withDist(async (root) => {
    const url =
      "https://raw.githubusercontent.com/teslamotors/custom-wraps/master/model3/template.png";
    await writePage(root, "index.html", `<noscript><img src="${url}" alt="template"></noscript>`);
    expect(checkLinks(root)).toEqual({
      ok: false,
      findings: [{ code: "tesla-hotlink", file: "index.html", tag: "img", url }],
    });
  });
});

it("reports a tesla raw hotlink in an htm file", async () => {
  await withDist(async (root) => {
    const url =
      "https://raw.githubusercontent.com/teslamotors/custom-wraps/master/model3/template.png";
    await writePage(root, "hotlink.htm", `<a href="${url}">template</a>`);
    expect(checkLinks(root)).toEqual({
      ok: false,
      findings: [{ code: "tesla-hotlink", file: "hotlink.htm", tag: "a", url }],
    });
  });
});

it("does not count a template link inside inert template content", async () => {
  await withDist(async (root) => {
    await writePage(
      root,
      "models/model3/index.html",
      `<template>${templateAnchor("model3")}</template>`,
    );
    expect(checkLinks(root)).toEqual({
      ok: false,
      findings: [
        {
          code: "missing-template-link",
          variant: "model3",
          file: "models/model3/index.html",
        },
      ],
    });
  });
});

it("allows an uppercase Tesla template host on a template marker", async () => {
  await withDist(async (root) => {
    const href = "https://GitHub.com/teslamotors/custom-wraps/tree/master/model3";
    await writePage(root, "index.html", `<a data-template-link href="${href}">templates</a>`);
    expect(checkLinks(root)).toEqual({ ok: true, templateLinks: 12 });
  });
});
