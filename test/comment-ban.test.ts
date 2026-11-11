import { ESLint } from "eslint";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

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
