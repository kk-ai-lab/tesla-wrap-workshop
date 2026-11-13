# PR #10 — independent review, round 2 (last allowed FAIL round)

## Verdict: FAIL — 3 evidence-backed findings

The original HTML/frontmatter and trailing-prose reproductions are fixed. The real-config regression tests now catch removal of either rule or the Astro parser configuration. However, the expanded source probes still admit **inline ESLint overrides, Astro CSS comments, and multiline SPDX exceptions**, violating AC3 or the explicitly narrowed three-form exception policy.

- [PR #10](https://github.com/kk-ai-lab/tesla-wrap-workshop/pull/10) · [issue #8](https://github.com/kk-ai-lab/tesla-wrap-workshop/issues/8)
- Reviewed head: `5a278c6aebb8f08e44eaea7de0d0cbcf6c00d81e`, fetched fresh and checked out exactly
- Base worktree retained: `7aaff63b28d8d317276fa9f49935270027b04544`, also `origin/main` at fetch time
- Node **v22.23.4**, npm **10.9.9**
- Review: **2026-11-11, 14:00–14:07 Europe/Dublin (GMT)**

No permanent source edits, commits, pushes, approvals, merges, or GitHub posts. Every tracked-file probe was restored with `git checkout`; new-path probes were deleted. Both worktrees are clean. Reports/logs are outside the checkout.

## 1. Findings and required guards

### R2-F1 — ESLint directives can disable the comment ban, including for themselves

**File/line:** [eslint.config.js:43–49](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/5a278c6aebb8f08e44eaea7de0d0cbcf6c00d81e/eslint.config.js#L43-L49), [72–79](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/5a278c6aebb8f08e44eaea7de0d0cbcf6c00d81e/eslint.config.js#L72-L79). The config has `allowEslintDirectives: false` inside the ban rule, but does not set ESLint's `linterOptions.noInlineConfig`.

Prepend to `src/domain/spec.ts`:

```ts
/* eslint-disable ban-comments/ban-comments */
// hack
```

`npm run lint` exits **0**, with no rule diagnostic. A single-line bypass also exits 0:

```ts
// eslint-disable-line ban-comments/ban-comments -- hack workaround
```

In `src/site/pages/index.astro`, add this to frontmatter:

```js
/* eslint-disable ban-comments/ban-comments, astro-comments/ban-html-comments */
```

Then add `<!-- hack -->` to its body. `npm run lint` again exits **0**. ESLint honors the directive before applying the ban's reported diagnostics, so a rule-level “directives not allowed” option cannot prevent self-suppression.

The effective options show `reportUnusedDisableDirectives: 1` and no `noInlineConfig`; unused-directive reporting does not help because these directives are used. The specifically requested `// eslint-disable-next-line …` mutation **is caught**: it cannot suppress the ban on its own preceding directive line. The file-wide and same-line variants bypass it.

**Required change:** set `linterOptions.noInlineConfig: true` for the source lint configuration, keeping directive comments forbidden by the ban. An in-memory API override with that option (no repository edit) rejects the same file-wide payload with **2 `ban-comments/ban-comments` errors**, confirming the remedy.

**Required guard:** add real-config must-fail fixtures for file-wide disable, disable-line, and the Astro two-rule disable; require named ban diagnostics. Those tests must fail if `noInlineConfig` is removed/turned off.

### R2-F2 — CSS comments inside an Astro source file remain unlinted

**File/line:** [eslint.config.js:20–39](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/5a278c6aebb8f08e44eaea7de0d0cbcf6c00d81e/eslint.config.js#L20-L39), [49](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/5a278c6aebb8f08e44eaea7de0d0cbcf6c00d81e/eslint.config.js#L49), [85–88](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/5a278c6aebb8f08e44eaea7de0d0cbcf6c00d81e/eslint.config.js#L85-L88). The local `astroHtmlCommentBan` visitor only inspects `AstroHTMLComment`; the configured Astro base parser/processor does not apply a CSS comment ban to style contents.

Insert into the body of `src/site/pages/index.astro`:

```astro
<style>
/* hack */
</style>
```

`npm run lint` exits **0**, no diagnostic. By contrast, a `// hack` inside a `<script>` tag exits 1 with `ban-comments/ban-comments`.

**Verdict impact:** FAIL under AC3's “a file under `src/`”. This is lint coverage of an existing Astro file, not a request to add styling. The AC and current three-form policy do not exempt CSS comments. If CSS is to be excluded, that narrowing needs Lead/Kai approval rather than being assumed by review.

**Required change:** cover CSS comment nodes inside Astro `<style>` blocks with an appropriate parser-backed lint check, integrated into `npm run lint`, or obtain explicit approval to narrow AC3.

**Required guard:** add a style-comment Astro fixture to the CI-executed real-config negative tests. Require the configured CSS/comment rule's diagnostic and make removing that coverage fail the test.

### R2-F3 — `\s+` admits multiline SPDX comments despite the single-line policy

**File/line:** [eslint.config.js:10](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/5a278c6aebb8f08e44eaea7de0d0cbcf6c00d81e/eslint.config.js#L10), shared through [13–17](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/5a278c6aebb8f08e44eaea7de0d0cbcf6c00d81e/eslint.config.js#L13-L17) and [79](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/5a278c6aebb8f08e44eaea7de0d0cbcf6c00d81e/eslint.config.js#L79).

The SPDX exception is anchored but uses `\s+` after the colon. That includes line breaks. Both of these pass `npm run lint` with **exit 0**, no diagnostic:

```ts
/* SPDX-License-Identifier:
MIT */
```

```astro
<!-- SPDX-License-Identifier:
MIT -->
```

I also confirmed the wrapped token `hack` passes in place of `MIT`; the finding is **the forbidden line break**, not a demand to add a new SPDX-ID registry validator.

**Verdict impact:** FAIL against the explicitly stated exception of a **single** `SPDX-License-Identifier: <id>` **line**. Leading/trailing whitespace around an otherwise valid single line is harmless and was accepted as a control; an internal newline is different.

**Required change:** restrict separator whitespace to same-line space/tab, or explicitly reject internal line breaks before matching the SPDX form. Preserve the bare issue/RFC URL controls.

**Required guard:** add must-fail wrapped-SPDX fixtures in both TS and Astro HTML, alongside must-pass single-line SPDX fixtures. The tests should fail if the separator is widened back to `\s+`.

### Repeat classification

The new automated tests **do fix** the earlier F1/F2-class rule-removal gap for both implemented bans and Astro configuration: all four removal mutations fail as expected. These three findings are additional coverage/exception/override gaps, not a surviving rules-off mutant. They still need regression fixtures at the boundaries; the previous exact bug examples are no longer enough.

## 2. Full local chain and real GitHub CI

All commands ran separately on the exact head; each logged its own exit code:

| Command | Key output | Exit |
|---|---|---|
| `npm ci` | Installed 377 packages | 0 |
| `npm run lint` | `eslint .`, no diagnostics | 0 |
| `npm run typecheck` | `tsc --noEmit`, no diagnostics | 0 |
| `npm test` | **34 passed**; new comment-ban suite has 10 tests | 0 |
| `npm run check` | `check: 1 wrap, 0 violations` | 0 |
| `npm run build` | Static output, one page, `Complete!` | 0 |

After all mutations were restored, lint/typecheck/test/check/build were rerun and **all again exited 0**, with 34 passing tests.

Verified through the connected GitHub tools, not unauthenticated `gh`:

- [Run **43033916286**, job **130567682173**, `check`](https://github.com/kk-ai-lab/tesla-wrap-workshop/actions/runs/43033916286/job/130567682173)
- `head_sha` = **5a278c6aebb8f08e44eaea7de0d0cbcf6c00d81e**
- `status: completed`, `conclusion: success`
- **2026-11-11, 13:57:54–13:58:09 Europe/Dublin (GMT)**
- All six command steps individually **completed / success**: install, lint, typecheck, test, check, build, in AC order.

The workflow is unchanged since round 1: `pull_request` plus `push` restricted to `main`, setup-node version 22, `contents: read`, no `secrets.*`, no deploy steps or skipped/allowed-failure npm stages. Actions remain tagged `@v4`, not SHA-pinned (non-blocking). `action-validator` and `actionlint` both exit 0 again.

## 3. Real-source comment/bypass matrix

Each entry below ran **`npm run lint`** on a real source-file mutation, separately, then restored it. No synthetic config was substituted. For the three new-path cases, a disposable file was created under `src/review-scope-probes/` and removed afterward.

**Rule legend:** **B** = `ban-comments/ban-comments`; **H** = `astro-comments/ban-html-comments`; **—** = no rule diagnostic. Literal `\n` denotes an inserted line break.

| Probe (location/context) | Injection | Exit | Rule | Policy result |
|---|---|---:|---|---|
| ts-line-hack | `// hack` | 1 | B | PASS |
| ts-block-workaround | `/* workaround */` | 1 | B | PASS |
| ts-jsdoc | `/** hack workaround */` | 1 | B | PASS |
| astro-html-hack | `<!-- hack -->` | 1 | H | PASS |
| astro-frontmatter-hack | `// hack` | 1 | B | PASS |
| ts-link-hack | `// see https://github.com/foo/bar/issues/1 hack workaround` | 1 | B | PASS |
| ts-licence-hack | `// Licence: this is a hack` | 1 | B | PASS |
| ts-bare-issue-url | `// https://github.com/foo/bar/issues/1` | 0 | — | PASS |
| ts-spdx-MIT | `// SPDX-License-Identifier: MIT` | 0 | — | PASS |
| ts-copyright-removed | `// Copyright 2026 kk-ai-lab` | 1 | B | PASS |
| ts-licensed-removed | `// Licensed under the MIT License` | 1 | B | PASS |
| ts-rights-removed | `// All rights reserved.` | 1 | B | PASS |
| ts-spdx-trailing-hack | `// SPDX-License-Identifier: MIT hack` | 1 | B | PASS |
| ts-block-link-plus-hack | `/* https://github.com/a/b/issues/1\n hack */` | 1 | B | PASS |
| ts-url-fragment | `// https://github.com/a/b/issues/1#hack` | 1 | B | PASS |
| ts-url-query | `// https://github.com/a/b/issues/1?hack=1` | 1 | B | PASS |
| ts-url-extra-path | `// https://github.com/a/b/issues/1/hack` | 1 | B | PASS |
| ts-evil-url | `// https://evil.example/github.com/a/b/issues/1` | 1 | B | PASS |
| ts-gitlab-url | `// https://gitlab.com/a/b/issues/1` | 1 | B | PASS |
| ts-padded-issue | `//    https://github.com/a/b/issues/1   ` | 0 | — | PASS |
| ts-padded-spdx | `/*   SPDX-License-Identifier: MIT   */` | 0 | — | PASS |
| ts-padded-hack | `//    hack   ` | 1 | B | PASS |
| ts-bare-rfc-editor | `// https://www.rfc-editor.org/rfc/rfc9110` | 0 | — | PASS |
| ts-bare-rfc-datatracker | `// https://datatracker.ietf.org/doc/html/rfc9110` | 0 | — | PASS |
| ts-spdx-wrapped-value | `/* SPDX-License-Identifier:\nMIT */` | 0 | — | **FAIL — bypass** |
| ts-spdx-wrapped-hack | `/* SPDX-License-Identifier:\nhack */` | 0 | — | **FAIL — bypass** |
| astro-expression-comment | `{/* hack */}` | 1 | B | PASS |
| astro-html-no-spaces | `<!--hack-->` | 1 | H | PASS |
| astro-html-multiline | `<!--\nhack\n-->` | 1 | H | PASS |
| astro-script-comment | `<script>\n// hack\n</script>` | 1 | B | PASS |
| astro-style-comment | `<style>\n/* hack */\n</style>` | 0 | — | **FAIL — bypass** |
| astro-html-bare-issue | `<!-- https://github.com/a/b/issues/1 -->` | 0 | — | PASS |
| astro-html-spdx-MIT | `<!-- SPDX-License-Identifier: MIT -->` | 0 | — | PASS |
| astro-html-spdx-wrapped | `<!-- SPDX-License-Identifier:\nMIT -->` | 0 | — | **FAIL — bypass** |
| ts-disable-next-line | `// eslint-disable-next-line ban-comments/ban-comments` | 1 | B | PASS |
| ts-disable-next-line-plus-hack | `// eslint-disable-next-line ban-comments/ban-comments\n// hack` | 1 | B | PASS |
| ts-disable-file | `/* eslint-disable ban-comments/ban-comments */\n// hack` | 0 | — | **FAIL — bypass** |
| ts-disable-line | `// eslint-disable-line ban-comments/ban-comments -- hack workaround` | 0 | — | **FAIL — bypass** |
| astro-disable-both | `/* eslint-disable ban-comments/ban-comments, astro-comments/ban-html-comments */` | 0 | — | **FAIL — bypass** |
| new-path-js | `// hack` | 1 | B | PASS |
| new-path-mjs | `// hack` | 1 | B | PASS |
| new-path-ts | `// hack` | 1 | B | PASS |

For original source paths: TS cases prepend the comment to `src/domain/spec.ts`; Astro cases use `src/site/pages/index.astro` in the indicated context. The new-path cases each contain `// hack` followed by an exported constant, avoiding unrelated unused-variable errors.

Leading/trailing whitespace around an otherwise permitted form passes because both rules trim the body before matching. Non-GitHub hosts, extra paths, queries/fragments, mixed link-plus-hack blocks, and trailing SPDX hack prose are correctly rejected. JSX/expression comments, ordinary script comments, compact HTML comments and multiline non-exempt HTML comments are correctly caught.

## 4. Guard-removal mutation results

`test/comment-ban.test.ts` loads the real `eslint.config.js` via `overrideConfigFile`, with `ignore: false` only for its negative/positive fixture execution. Its 7 must-fail tests assert the **specific rule ID**, not merely any error:

```ts
expect(result.messages.map((message) => message.ruleId)).toContain(
  "astro-comments/ban-html-comments",
);
```

The frontmatter and five TS-policy negative fixtures require `ban-comments/ban-comments`. Both must-pass tests require `errorCount === 0` **and** `messages === []`.

| Temporary config mutation | `npm test` result | Exit |
|---|---|---|
| Both ban rules off | **7 failed, 27 passed** | 1 |
| B only off | **6 failed, 28 passed** | 1 |
| H only off | **1 failed, 33 passed** | 1 |
| Remove `...eslintPluginAstro.configs["flat/base"]` | **2 failed, 32 passed** (HTML and frontmatter guards) | 1 |
| Restore committed config | **34 passed** | 0 |

Every config mutation was reverted using `git checkout -- eslint.config.js`; the checkout was clean after each. Build's claimed 7-failure result is confirmed. CI's normal `npm test` now executes these regression tests.

## 5. Fixture isolation and build safety

`eslint.config.js:45` excludes `test/lint-fixtures/**` from the normal project lint. `npm run lint` exits 0 despite the intentional bad comments there. Enumerating `new ESLint().lintFiles(["."])` reports **16 project files, 0 fixture files, 0 errors**.

The exclusion test at `test/comment-ban.test.ts:72–86` creates a second ESLint instance with the normal ignores enabled. For `licence-hack.ts`, it asserts both:

```ts
expect(result.messages.some((message) => message.ruleId === "ban-comments/ban-comments")).toBe(false);
expect(result.messages.some((message) => message.message.includes("ignored"))).toBe(true);
```

Thus it explicitly requires an ignore diagnostic, not merely a passing fixture. The global ignore pattern affects only the fixture tree; real `src/` paths, including new `.js`, `.mjs` and `.ts` paths, are still linted (the matrix proves this).

The static build's complete file listing (`rg --files dist`) is:

```text
dist/index.html
dist/wraps/sample-solid-grey/Solid Grey.png
```

No fixture appears in `dist`, and neither `src/` nor `astro.config.mjs` references the fixture tree. Astro builds from `src/site`, not `test/`.

## 6. File list, scope, main comparison and lockfile

`git diff --name-status origin/main...HEAD` lists **14 files**, matching Lead:

```text
A  .github/workflows/ci.yml
A  eslint.config.js
M  package-lock.json
M  package.json
A  test/comment-ban.test.ts
A  test/lint-fixtures/bare-issue-url.ts
A  test/lint-fixtures/copyright-hack.ts
A  test/lint-fixtures/frontmatter-comment.astro
A  test/lint-fixtures/html-comment.astro
A  test/lint-fixtures/issue-link-hack.ts
A  test/lint-fixtures/licence-hack.ts
A  test/lint-fixtures/rights-reserved-hack.ts
A  test/lint-fixtures/spdx-hack.ts
A  test/lint-fixtures/spdx-line.ts
```

Since `cfe92de`, **13 files changed, +542/−12**: config/package/lock changes plus the new test and nine fixtures. The workflow itself is unchanged. The local HTML rule is defined inline at `eslint.config.js:20–41` and registered under `astro-comments` at lines 65–69; it is not a separate dependency. Installed Astro ESLint support is `eslint-plugin-astro` 1.7.0.

**Important qualification to “src/docs unchanged against main”:**

- `src/` is byte-identical to main.
- The requested direct command `git diff --exit-code 7aaff63 HEAD -- src docs` exits **1**, not 0: the branch lacks main's later #9 documentation commit. The two older doc files differ and `docs/reviews/pr-7-round-1.md` is absent in the branch checkout.
- The merge base is `7f60f271548b41801e916679d6090e02c7aa2970`; `git log HEAD..7aaff63` shows the main-only #9 docs commit. **`git diff 7aaff63...HEAD -- src docs` is empty**: the PR itself does not modify or delete these documents.
- To distinguish ancestry drift from an actual deletion, computed a three-way tree using `git merge-tree --write-tree 7aaff63 HEAD`, without changing a branch, working tree, or creating a commit. It merges cleanly; comparing its `src/` and `docs/` with main exits **0**. Main's docs survive. **Not a FAIL.** No rebase was performed.

Lockfile audit **since round 1**:

- **27 added package entries**, **0 removed**, no existing package version changed.
- All 27 are reachable from `eslint-plugin-astro` and its dependency/peer tree (including `astro-eslint-parser`, compiler support and glob helpers); no unrelated additions.
- All added entries resolve from **registry.npmjs.org** with **sha512 integrity hashes**.
- The only changed existing entry is the root's added `eslint-plugin-astro` dev dependency. No existing resolved URL/integrity churn.

No production source changes, loosened existing assertions, `.skip`/`.only`/`.todo`, or unrelated workflow changes. The intentional hack comments are **negative test fixtures**, isolated and asserted by tests, not explanations of production workarounds. Test names containing `//` are strings, not code comments.

## 7. Verification skill

Ran the unchanged `.cursor/skills/verify-wrap-workshop/` instructions against this head after a successful install/build. Started a new preview with Node 22 directly, verified its PID matched this checkout and the listener, then ran the doctor and driver:

```text
HTTP/1.1 200 OK
node -v -> v22.23.4

$ node scripts/verify-site.mjs http://127.0.0.1:4173
listed sample-solid-grey
link /wraps/sample-solid-grey/Solid%20Grey.png
file dist/wraps/sample-solid-grey/Solid Grey.png 3154 bytes
GET http://127.0.0.1:4173/wraps/sample-solid-grey/Solid%20Grey.png 200 image/png 3154 bytes
EXIT=0

$ npm run check
check: 1 wrap, 0 violations
EXIT=0
```

The helper validates byte equality. Cleanup killed only this run's verified node process; confirmed it was gone, curl exited 7 (connection refused), removed its PID file and retained proof files. No user-facing path changed, so no skill-update gap.

## 8. Codex and unverified opinions

**Not run.** Step 8 permits the optional read only if every deterministic check passes. Although the baseline commands, guard-removal tests and site proof pass, the required expanded acceptance probes expose the three failures above. The read gate therefore does not pass. **Codex token cost: 0; no attempt this round.** No quota workaround and no unverified model opinions.

## Outcome and next step

**FAIL, 3 evidence-backed findings**, appended to the failure log. This is the last allowed FAIL round: hand the decision back to Eng Lead rather than silently starting another review cycle. Build needs (1) non-overridable source lint, (2) a decision/implementation for Astro CSS comments, and (3) truly single-line SPDX exceptions, each protected by real-config tests. Alternatively, Lead/Kai must explicitly approve any policy narrowing. The successful CI run alone does not establish AC3 across those boundaries.

Local evidence is retained under `logs/r2/`: command outputs, full per-case source mutations, matrix summary, rule-removal logs, CI job metadata, lockfile audit, fixture enumeration, docs merge proof, and site verification. Both worktrees remain clean at their specified SHAs.
