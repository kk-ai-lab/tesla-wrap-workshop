import { expect, it } from "vitest";
import { commentLintKinds } from "../eslint.config.js";
import { scannerInputKinds } from "../scripts/check-dist.ts";
import { runCommentLintKindCheck, runScannerInputCheck } from "../scripts/check-scanner-inputs.ts";

const distKindIds = [
  "script-classic",
  "script-module",
  "script-json",
  "script-unknown",
  "attr-style",
  "attr-event",
  "attr-srcdoc",
  "json-key",
  "json-value",
  "json-duplicate-key",
  "json-invalid",
  "extension-html",
  "extension-css",
  "extension-js",
  "extension-mjs",
  "extension-cjs",
  "extension-unknown",
  "tag-style",
  "tag-script",
  "noscript",
  "svg-inline",
  "svg-file",
  "script-extra-attr",
  "opaque-png",
  "opaque-jpg",
  "opaque-jpeg",
  "opaque-gif",
  "opaque-webp",
  "opaque-avif",
  "opaque-ico",
  "opaque-bmp",
  "opaque-woff",
  "opaque-woff2",
  "opaque-ttf",
  "opaque-otf",
  "opaque-eot",
  "robots-txt",
  "symlink",
  "parse-error",
];

const commentLintKindIds = [
  "astro-html",
  "astro-style",
  "astro-set-directive",
  "astro-style-attribute",
  "astro-uninspected-style",
  "ts-line-comment",
  "astro-frontmatter",
];

it("pins the dist scanner input kind ids", () => {
  expect(Object.keys(scannerInputKinds)).toEqual(distKindIds);
});

it("pins the comment lint kind ids", () => {
  expect(commentLintKinds.map((kind) => kind.id)).toEqual(commentLintKindIds);
});

it("every dist scanner input kind has a bad fixture", () => {
  const result = runScannerInputCheck();
  expect(result).toEqual({ status: 0, text: "" });
});

it("every comment lint kind has a bad fixture", async () => {
  const result = await runCommentLintKindCheck();
  expect(result).toEqual({ status: 0, text: "" });
});
