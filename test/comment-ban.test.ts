import { ESLint } from "eslint";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it, vi } from "vitest";

vi.setConfig({ testTimeout: 30_000 });

const root = fileURLToPath(new URL("..", import.meta.url));

const eslint = new ESLint({
  cwd: root,
  overrideConfigFile: path.join(root, "eslint.config.js"),
  ignore: false,
});

async function lintFixture(rel: string) {
  const results = await eslint.lintFiles([path.join(root, rel)]);
  const result = results[0];
  if (result === undefined) {
    throw new Error(`missing lint result for ${rel}`);
  }
  return result;
}

it("fails lint for an html comment in .astro", async () => {
  const result = await lintFixture("test/lint-fixtures/html-comment.astro");
  expect(result.messages.map((message) => message.ruleId)).toContain(
    "astro-comments/ban-html-comments",
  );
});

it("fails lint for a frontmatter comment in .astro", async () => {
  const result = await lintFixture("test/lint-fixtures/frontmatter-comment.astro");
  expect(result.messages.map((message) => message.ruleId)).toContain("ban-comments/ban-comments");
});

it("fails lint for // see https://github.com/foo/bar/issues/1 hack workaround", async () => {
  const result = await lintFixture("test/lint-fixtures/issue-link-hack.ts");
  expect(result.messages.map((message) => message.ruleId)).toContain("ban-comments/ban-comments");
});

it("fails lint for // Licence: this is a hack", async () => {
  const result = await lintFixture("test/lint-fixtures/licence-hack.ts");
  expect(result.messages.map((message) => message.ruleId)).toContain("ban-comments/ban-comments");
});

it("fails lint for // Copyright 2026 this is a hack", async () => {
  const result = await lintFixture("test/lint-fixtures/copyright-hack.ts");
  expect(result.messages.map((message) => message.ruleId)).toContain("ban-comments/ban-comments");
});

it("fails lint for // All rights reserved hack", async () => {
  const result = await lintFixture("test/lint-fixtures/rights-reserved-hack.ts");
  expect(result.messages.map((message) => message.ruleId)).toContain("ban-comments/ban-comments");
});

it("fails lint for // SPDX-License-Identifier: MIT hack", async () => {
  const result = await lintFixture("test/lint-fixtures/spdx-hack.ts");
  expect(result.messages.map((message) => message.ruleId)).toContain("ban-comments/ban-comments");
});

it("fails lint for a file-wide eslint-disable around // hack", async () => {
  const result = await lintFixture("test/lint-fixtures/eslint-disable-file.ts");
  expect(result.messages.map((message) => message.ruleId)).toContain("ban-comments/ban-comments");
});

it("fails lint for // eslint-disable-line ban-comments/ban-comments -- hack workaround", async () => {
  const result = await lintFixture("test/lint-fixtures/eslint-disable-line.ts");
  expect(result.messages.map((message) => message.ruleId)).toContain("ban-comments/ban-comments");
});

it("fails lint for an astro eslint-disable around an html comment", async () => {
  const result = await lintFixture("test/lint-fixtures/eslint-disable-astro.astro");
  const ruleIds = result.messages.map((message) => message.ruleId);
  expect(ruleIds).toContain("ban-comments/ban-comments");
  expect(ruleIds).toContain("astro-comments/ban-html-comments");
});

it("fails lint for set:html on a style element", async () => {
  const result = await lintFixture("test/lint-fixtures/style-set-html.astro");
  expect(result.messages.map((message) => message.ruleId)).toContain(
    "astro-comments/ban-style-set-directive",
  );
});

it("fails lint for set:text on a style element", async () => {
  const result = await lintFixture("test/lint-fixtures/style-set-text.astro");
  expect(result.messages.map((message) => message.ruleId)).toContain(
    "astro-comments/ban-style-set-directive",
  );
});

it("fails lint for a static style attribute comment", async () => {
  const result = await lintFixture("test/lint-fixtures/style-attr-static.astro");
  expect(result.messages.map((message) => message.ruleId)).toContain(
    "astro-comments/ban-style-attribute-comment",
  );
});

it("fails lint for a dynamic style attribute comment", async () => {
  const result = await lintFixture("test/lint-fixtures/style-attr-dynamic.astro");
  expect(result.messages.map((message) => message.ruleId)).toContain(
    "astro-comments/ban-style-attribute-comment",
  );
});

it("fails lint for a template literal style attribute comment", async () => {
  const result = await lintFixture("test/lint-fixtures/style-attr-template.astro");
  expect(result.messages.map((message) => message.ruleId)).toContain(
    "astro-comments/ban-style-attribute-comment",
  );
});

it("fails lint for a style element with lang scss", async () => {
  const result = await lintFixture("test/lint-fixtures/style-lang-scss.astro");
  expect(result.messages.map((message) => message.ruleId)).toContain(
    "astro-comments/ban-uninspected-style",
  );
});

it("fails lint for lang SCSS", async () => {
  const result = await lintFixture("test/lint-fixtures/style-lang-scss-upper.astro");
  expect(result.messages.map((message) => message.ruleId)).toContain(
    "astro-comments/ban-uninspected-style",
  );
});

it("fails lint for lang CSS", async () => {
  const result = await lintFixture("test/lint-fixtures/style-lang-css-upper.astro");
  expect(result.messages.map((message) => message.ruleId)).toContain(
    "astro-comments/ban-uninspected-style",
  );
});

it("fails lint for a scss line comment in a style element", async () => {
  const result = await lintFixture("test/lint-fixtures/style-lang-scss-line.astro");
  expect(result.messages.map((message) => message.ruleId)).toContain(
    "astro-comments/ban-uninspected-style",
  );
});

it("fails lint for a css comment in an astro style block", async () => {
  const result = await lintFixture("test/lint-fixtures/style-comment.astro");
  expect(result.messages.map((message) => message.ruleId)).toContain(
    "astro-comments/ban-style-comments",
  );
});

it("fails lint for a wrapped SPDX comment in ts", async () => {
  const result = await lintFixture("test/lint-fixtures/spdx-wrapped.ts");
  expect(result.messages.map((message) => message.ruleId)).toContain("ban-comments/ban-comments");
});

it("fails lint for a wrapped SPDX comment in astro html", async () => {
  const result = await lintFixture("test/lint-fixtures/spdx-wrapped.astro");
  expect(result.messages.map((message) => message.ruleId)).toContain(
    "astro-comments/ban-html-comments",
  );
});

it("passes lint for a bare issue URL comment", async () => {
  const result = await lintFixture("test/lint-fixtures/bare-issue-url.ts");
  expect(result.errorCount).toBe(0);
  expect(result.messages).toEqual([]);
});

it("passes lint for an SPDX line", async () => {
  const result = await lintFixture("test/lint-fixtures/spdx-line.ts");
  expect(result.errorCount).toBe(0);
  expect(result.messages).toEqual([]);
});

it("passes lint for a plain style block", async () => {
  const result = await lintFixture("test/lint-fixtures/style-plain.astro");
  expect(result.errorCount).toBe(0);
  expect(result.messages).toEqual([]);
});

it("passes lint for a normal style attribute", async () => {
  const result = await lintFixture("test/lint-fixtures/style-attr-plain.astro");
  expect(result.errorCount).toBe(0);
  expect(result.messages).toEqual([]);
});

it("passes lint for an astro html SPDX line", async () => {
  const result = await lintFixture("test/lint-fixtures/spdx-line.astro");
  expect(result.errorCount).toBe(0);
  expect(result.messages).toEqual([]);
});

it("does not lint comment fixtures during npm run lint", async () => {
  const project = new ESLint({
    cwd: root,
    overrideConfigFile: path.join(root, "eslint.config.js"),
  });
  const results = await project.lintFiles([path.join(root, "test/lint-fixtures/licence-hack.ts")]);
  const result = results[0];
  if (result === undefined) {
    throw new Error("missing ignored-fixture result");
  }
  expect(result.messages.some((message) => message.ruleId === "ban-comments/ban-comments")).toBe(
    false,
  );
  expect(result.messages.some((message) => message.message.includes("ignored"))).toBe(true);
});
