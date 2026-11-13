# PR #10 — final review, round 3

## Verdict at `fbf0319`: FAIL

**One remaining evidence-backed finding: R2-F2's embedded-style coverage is incomplete.** All exact R2 reproductions are fixed, including inline-disable and wrapped-SPDX cases. All five guard mutations are caught. Nevertheless, three fresh style variants pass lint; two also build successfully with the forbidden comments in the generated HTML.

- [PR #10](https://github.com/kk-ai-lab/tesla-wrap-workshop/pull/10) · [issue #8](https://github.com/kk-ai-lab/tesla-wrap-workshop/issues/8)
- Exact reviewed head: `fbf0319e9f4b0c0f6a3eb1284e9c78e0bb1385c0`
- Base and merge-base: `7aaff63b28d8d317276fa9f49935270027b04544`
- Node **v22.23.4**, npm **10.9.9**
- Review performed **2026-11-11, 14:38–14:46 Europe/Dublin (GMT)**

Fetched the rewritten pull ref with `git fetch origin +refs/pull/10/head` and checked out the exact SHA. Both working trees remain clean. No permanent code edits, commits, pushes, approvals, merges, or GitHub posts were made. Temporary source/config changes were restored with `git checkout`; disposable files were removed. All install experiments were confined to this review checkout.

## R3-F1 — remaining R2-F2 style-comment coverage gap

**File/line:** [eslint.config.js:90–97](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/fbf0319e9f4b0c0f6a3eb1284e9c78e0bb1385c0/eslint.config.js#L90-L97) handles only direct `AstroRawText` children of a `<style>` element; [37–46](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/fbf0319e9f4b0c0f6a3eb1284e9c78e0bb1385c0/eslint.config.js#L37-L46) always parses that text with the default CSS parser, irrespective of `lang`.

The following were inserted separately into `src/site/pages/index.astro`. For each, **`npm run lint` exits 0, no diagnostic**:

### a. Style content supplied through `set:html`

```astro
<style set:html={"/* hack */"}></style>
```

There are no raw-text children for the visitor to inspect. `npm run build` also exits **0**. The built index contains:

```html
<body><style>/* hack */</style><ul>
```

### b. An inline CSS style attribute

```astro
<div style="/* hack */ color:red">probe</div>
```

The rule never inspects CSS-bearing attributes. `npm run build` exits **0**, and the built index contains:

```html
<div style="/* hack */ color:red">probe</div>
```

These are not arbitrary JavaScript strings containing comment-looking text: both are literal embedded CSS locations that render actual CSS comments. AC3 requires lint to fail for a forbidden comment in a file under `src/`; no exception for these source contexts was approved.

### c. A SCSS end-of-line comment treated as CSS value text

```astro
<style lang="scss">.x { color: red // hack
; }</style>
```

Default PostCSS parsing accepts the `// hack` as value text rather than a comment, so `walkComments` finds nothing. A standalone SCSS `// hack` is rejected by the parse-error fallback, but this valid SCSS line-comment placement escapes it.

**Qualification:** the build of this SCSS probe exits **1** because `sass-embedded` is not installed. It is therefore **not** a demonstrated current full-CI escape or shipped SCSS asset. It still fails AC3's lint-only requirement as written. Even if Lead excludes unsupported SCSS, the two plain-CSS cases above remain independently blocking.

### Required change and guard

- Cover literal CSS-bearing `style` attributes and `set:html` content, or reject unsupported style-content injection at the lint boundary rather than silently skipping it.
- Select a dialect-aware parser for supported `lang` values, or fail closed on unsupported style languages; do not rely on accidental CSS parse errors to catch SCSS comments.
- Add real-config negative fixtures for all three cases. Require a named comment-ban diagnostic, and prove that removing attribute coverage or reverting dialect handling makes the corresponding tests fail. Keep the existing bare URL and SPDX controls passing.

This is **one remaining R2-F2 boundary-coverage finding with three reproductions**, not three unrelated scope additions. R2-F1 and R2-F3 are closed. The earlier F1/F2-class guard-removal test problem is also closed for the implemented controls: all requested removal mutations fail.

## 1. Original R2 reproductions and controls

Reran all **42** real-source probes from R2, separately restoring the checkout after each. **42/42 now behave as intended**, including the seven previously unexpected passes. Also tested wrapped SPDX with `hack` in Astro HTML, which now fails with the HTML ban rule.

**Rule legend for both tables:**

- **B** = `ban-comments/ban-comments`
- **H** = `astro-comments/ban-html-comments`
- **S** = `astro-comments/ban-style-comments`
- **I** = `no-irregular-whitespace`
- **—** = no rule diagnostic

All table entries ran **`npm run lint`**. Literal `\n`, `\r`, `\t` and Unicode escapes identify the actual inserted characters. TS probes use `src/domain/spec.ts`; Astro probes use `src/site/pages/index.astro`. The three new-path probes used disposable files under `src/review-scope-probes/`.

| Probe | Injection / context | Exit | Rule(s) | Result |
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
| ts-spdx-wrapped-value | `/* SPDX-License-Identifier:\nMIT */` | 1 | B | PASS |
| ts-spdx-wrapped-hack | `/* SPDX-License-Identifier:\nhack */` | 1 | B | PASS |
| astro-expression-comment | `{/* hack */}` | 1 | B | PASS |
| astro-html-no-spaces | `<!--hack-->` | 1 | H | PASS |
| astro-html-multiline | `<!--\nhack\n-->` | 1 | H | PASS |
| astro-script-comment | `<script>\n// hack\n</script>` | 1 | B | PASS |
| astro-style-comment | `<style>\n/* hack */\n</style>` | 1 | S | PASS |
| astro-html-bare-issue | `<!-- https://github.com/a/b/issues/1 -->` | 0 | — | PASS |
| astro-html-spdx-MIT | `<!-- SPDX-License-Identifier: MIT -->` | 0 | — | PASS |
| astro-html-spdx-wrapped | `<!-- SPDX-License-Identifier:\nMIT -->` | 1 | H | PASS |
| ts-disable-next-line | `// eslint-disable-next-line ban-comments/ban-comments` | 1 | B | PASS |
| ts-disable-next-line-plus-hack | `// eslint-disable-next-line ban-comments/ban-comments\n// hack` | 1 | B | PASS |
| ts-disable-file | `/* eslint-disable ban-comments/ban-comments */\n// hack` | 1 | B | PASS |
| ts-disable-line | `// eslint-disable-line ban-comments/ban-comments -- hack workaround` | 1 | B | PASS |
| astro-disable-both | `/* eslint-disable ban-comments/ban-comments, astro-comments/ban-html-comments */` | 1 | H, B | PASS |
| new-path-js | `// hack` | 1 | B | PASS |
| new-path-mjs | `// hack` | 1 | B | PASS |
| new-path-ts | `// hack` | 1 | B | PASS |

Original R2-F1's file-wide disable, same-line disable and Astro two-rule disable all produce named ban errors. R2-F2's ordinary raw `<style>/* hack */</style>` now fails with S. Wrapped SPDX comments with either MIT or hack now fail in both TS and HTML. Bare issue/RFC URLs, single-line SPDX and padded permitted forms still pass.

## 2. Fresh style/dialect/whitespace probes

**31/34 behaved as intended; 3 silently accepted comment-bearing style cases**, grouped in R3-F1 above. Each was restored separately. No parser-only failure was mistaken for a named ban result.

| Probe | Injection / context | Exit | Rule(s) | Result |
|---|---|---:|---|---|
| style-is-global | `<style is:global>\n/* hack */\n</style>` | 1 | S | PASS |
| style-lang-scss-block | `<style lang="scss">\n/* hack */\n</style>` | 1 | S | PASS |
| style-lang-css | `<style lang="css">\n/* hack */\n</style>` | 1 | S | PASS |
| style-second-block | `<style>.first { color: red; }</style>\n<style>/* hack */</style>` | 1 | S | PASS |
| style-nested-rule | `<style>.outer { .inner { /* hack */ color: red; } }</style>` | 1 | S | PASS |
| style-media | `<style>@media (min-width: 1px) { /* hack */ .x { color: red; } }</style>` | 1 | S | PASS |
| style-supports | `<style>@supports (display: grid) { .x { /* hack */ display: grid; } }</style>` | 1 | S | PASS |
| style-layer | `<style>@layer probe { .x { /* hack */ color: red; } }</style>` | 1 | S | PASS |
| style-nested-element | `<div><style>/* hack */</style></div>` | 1 | S | PASS |
| style-component-slot | `<Fragment slot="content"><style>/* hack */</style></Fragment>` | 1 | S | PASS |
| style-in-expression | `{wraps.length > 0 && <style>/* hack */</style>}` | 1 | S | PASS |
| style-set-html | `<style set:html={"/* hack */"}></style>` | 0 | — | **BYPASS** |
| inline-style-comment | `<div style="/* hack */ color:red">probe</div>` | 0 | — | **BYPASS** |
| style-invalid-css | `<style>.broken { color: red; /* hack */</style>` | 1 | S | PASS |
| style-invalid-unclosed-comment | `<style>/* hack</style>` | 1 | S | PASS |
| style-css-disable-directive | `<style>/* eslint-disable astro-comments/ban-style-comments */\n/* hack */</style>` | 1 | S | PASS |
| style-scss-line-comment | `<style lang="scss">\n// hack\n</style>` | 1 | S | PASS |
| style-scss-inline-line-comment | `<style lang="scss">.x { color: red // hack\n; }</style>` | 0 | — | **BYPASS** |
| style-spdx-control | `<style>/* SPDX-License-Identifier: MIT */</style>` | 0 | — | PASS |
| style-issue-control | `<style>/* https://github.com/a/b/issues/1 */</style>` | 0 | — | PASS |
| style-spdx-tab | `<style>/* SPDX-License-Identifier:\tMIT */</style>` | 0 | — | PASS |
| style-spdx-crlf | `<style>/* SPDX-License-Identifier:\r\nMIT */</style>` | 1 | S | PASS |
| style-spdx-u2028 | `<style>/* SPDX-License-Identifier:\u2028MIT */</style>` | 1 | S, I | PASS |
| style-spdx-nbsp | `<style>/* SPDX-License-Identifier:\u00a0MIT */</style>` | 1 | S, I | PASS |
| style-spdx-wrapped-hack | `<style>/* SPDX-License-Identifier:\nhack */</style>` | 1 | S | PASS |
| html-spdx-wrapped-hack | `<!-- SPDX-License-Identifier:\nhack -->` | 1 | H | PASS |
| ts-spdx-tab | `/* SPDX-License-Identifier:\tMIT */` | 0 | — | PASS |
| html-spdx-tab | `<!-- SPDX-License-Identifier:\tMIT -->` | 0 | — | PASS |
| ts-spdx-crlf | `/* SPDX-License-Identifier:\r\nMIT */` | 1 | B | PASS |
| html-spdx-crlf | `<!-- SPDX-License-Identifier:\r\nMIT -->` | 1 | H | PASS |
| ts-spdx-u2028 | `/* SPDX-License-Identifier:\u2028MIT */` | 1 | B, I | PASS |
| html-spdx-u2028 | `<!-- SPDX-License-Identifier:\u2028MIT -->` | 1 | H, I | PASS |
| ts-spdx-nbsp | `/* SPDX-License-Identifier:\u00a0MIT */` | 1 | B, I | PASS |
| html-spdx-nbsp | `<!-- SPDX-License-Identifier:\u00a0MIT -->` | 1 | H, I | PASS |

The cases cover `is:global`, `lang="scss"`, `lang="css"`, a second style block, nested rules, `@media`, `@supports`, `@layer`, nested HTML, a component slot and an Astro conditional expression. Those block-comment cases all fail with **S**.

**Invalid CSS:** both malformed/unclosed cases fail with **S**, not a crash or silent pass. The PostCSS catch path reports a lint error (lines 39–43). CSS disable-directive comments cannot disable the local style ban. The successful style SPDX/issue controls show the rule uses the same exception policy rather than banning all style comments indiscriminately.

**Whitespace:** a tab after the SPDX colon passes in TS, HTML and CSS; CRLF, U+2028 and NBSP separators fail in all three. Some irregular-whitespace cases also report I, but the relevant ban rule is present independently.

## 3. Mutation proof and new guards

The comment-ban suite now has **17 tests**: 13 must-fail fixtures asserting specific rule IDs, 3 must-pass fixtures asserting no messages, and 1 fixture-exclusion test. This is seven more tests than R2 (six negative, one positive), for **41 tests total**.

It imports the real `eslint.config.js`; no stubbed rule behavior is used. Examples of the new assertions:

```ts
expect(ruleIds).toContain("ban-comments/ban-comments");
expect(ruleIds).toContain("astro-comments/ban-html-comments");
```

The CSS fixture specifically requires `astro-comments/ban-style-comments`, and wrapped SPDX fixtures require B/H respectively.

Each mutation ran `npm test -- --reporter=verbose`, then `git checkout -- eslint.config.js` and a clean-tree check:

| Mutation | Result | Exit |
|---|---|---:|
| Remove `noInlineConfig: true` | **3 failed, 38 passed** | 1 |
| Set `noInlineConfig: false` | **3 failed, 38 passed** | 1 |
| Set style rule to `off` | **1 failed, 40 passed** | 1 |
| Change SPDX `[ \t]+` back to `\s+` | **2 failed, 39 passed** | 1 |
| Remove style rule registration | **6 failed, 35 passed** | 1 |
| Restore committed configuration | **41 passed** | 0 |

The missing-registration mutation fails six Astro-fixture tests because their configured style rule cannot be resolved; it fails safely rather than silently accepting them. Build's reported 3/1/2 counts are confirmed. Turning `noInlineConfig` to false is also caught, not just deleting the line.

## 4. Full chain and actual GitHub state

Initial full chain and the final restored chain both ran under Node 22:

| Command | Key output | Exit |
|---|---|---:|
| `npm ci` | Installed 377 packages | 0 |
| `npm run lint` | `eslint .`, clean baseline | 0 |
| `npm run typecheck` | `tsc --noEmit`, no diagnostics | 0 |
| `npm test` | **41 passed** | 0 |
| `npm run check` | `check: 1 wrap, 0 violations` | 0 |
| `npm run build` | Static output, one page, `Complete!` | 0 |

Verified via the connected GitHub tools:

- PR head matches **fbf0319e9f4b0c0f6a3eb1284e9c78e0bb1385c0**.
- **21 changed files**, `mergeable: true`, `mergeable_state: clean`.
- [Run **43039939676**](https://github.com/kk-ai-lab/tesla-wrap-workshop/actions/runs/43039939676), job **130588704535**: **completed / success**, exact matching head SHA.
- **2026-11-11, 14:35:30–14:35:56 Europe/Dublin (GMT)**.
- Every required npm step individually succeeded: ci, lint, typecheck, test, check, build, in that order.

The workflow is unchanged from R2: pull requests and pushes to main, Node 22, read-only `contents` permission, no `secrets.*` references or deployment stage. Both workflow validators pass again. No approval or merge action was taken.

## 5. Scope after the rebase

The pull-ref fetch accommodated rewritten history. I compared **trees**, not commit ancestry, for round-to-round content:

```text
git diff --exit-code 5a278c6 HEAD -- src .github    -> 0
git diff --exit-code 7aaff63 HEAD -- src docs       -> 0
git merge-base 7aaff63 HEAD                       -> 7aaff63b28d8d317276fa9f49935270027b04544
git diff --exit-code 5a278c6 HEAD -- package.json package-lock.json -> 0
```

Main's documentation is now present; the R2 ancestry-drift qualification is resolved. No source/workflow content changed this round. Functional round-to-round changes are `eslint.config.js`, `test/comment-ban.test.ts`, and seven new fixtures. Documentation additions visible in a direct old-head/new-head comparison are exactly the main commit brought in by rebasing, not unrelated PR edits.

`git diff --name-status origin/main...HEAD` lists:

```text
A	.github/workflows/ci.yml
A	eslint.config.js
M	package-lock.json
M	package.json
A	test/comment-ban.test.ts
A	test/lint-fixtures/bare-issue-url.ts
A	test/lint-fixtures/copyright-hack.ts
A	test/lint-fixtures/eslint-disable-astro.astro
A	test/lint-fixtures/eslint-disable-file.ts
A	test/lint-fixtures/eslint-disable-line.ts
A	test/lint-fixtures/frontmatter-comment.astro
A	test/lint-fixtures/html-comment.astro
A	test/lint-fixtures/issue-link-hack.ts
A	test/lint-fixtures/licence-hack.ts
A	test/lint-fixtures/rights-reserved-hack.ts
A	test/lint-fixtures/spdx-hack.ts
A	test/lint-fixtures/spdx-line.astro
A	test/lint-fixtures/spdx-line.ts
A	test/lint-fixtures/spdx-wrapped.astro
A	test/lint-fixtures/spdx-wrapped.ts
A	test/lint-fixtures/style-comment.astro
```

**Lockfile delta since R2: zero** — no new packages, removals, version changes, or metadata changes. No package.json changes either. The dependency tree added in R2 remains intact.

The only added hack comments are intentional isolated negative fixtures. Existing assertions were not loosened; no `.skip`, `.only` or unrelated production edits. `git diff --check` passes.

## 6. PostCSS dependency — non-blocking packaging note

[eslint.config.js:4](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/fbf0319e9f4b0c0f6a3eb1284e9c78e0bb1385c0/eslint.config.js#L4) directly imports:

```js
import postcss from "postcss";
```

`package.json` declares neither a dependency nor devDependency named `postcss`. Today it resolves to **8.5.32**, and `package-lock.json` contains a top-level **`node_modules/postcss`** entry with an npm-registry URL and sha512 integrity.

`npm ls postcss` shows:

```text
astro@7.4.7 -> vite@8.3.6 -> postcss@8.5.32 (deduped)
eslint-plugin-astro@1.7.0 -> postcss@8.5.32
vitest@3.2.7 -> vite / vite-node -> postcss@8.5.32 (deduped)
```

Proved clean installation, not just reuse of old node_modules:

| Install experiment | Install exit | `npm run lint` exit | Resolution |
|---|---:|---:|---|
| Remove checkout's node_modules; `npm ci` | 0 | 0 | top-level PostCSS 8.5.32 |
| Remove node_modules again; `npm ci --omit=optional` | 0 | 0 | top-level PostCSS 8.5.32 |

Normal optional dependencies were then restored with `npm ci` and the full chain rerun successfully. **Not a FAIL:** clean npm installs work today. The direct import nevertheless relies on transitive hoisting and can break with strict dependency resolution/pnpm, a hoisting change or an Astro/plugin tree change. Follow-up: declare PostCSS directly as a devDependency. No dependency modification was made by review.

## 7. Fixture isolation and verification skill

`npm run lint` excludes the entire fixture directory. Direct project enumeration using the real ESLint config reports **0 fixture paths and 0 errors**. The exclusion test still requires an actual ignored-file message, not merely absence of a ban diagnostic.

After restoring clean source and normal dependencies, the full static build contains only:

```text
dist/index.html
dist/wraps/sample-solid-grey/Solid Grey.png
```

No fixtures ship. The earlier intentionally mutated build artifacts were overwritten by the restored build before site verification.

Ran the unchanged `verify-wrap-workshop` instructions: fresh directly launched Node 22 preview, verified PID/checkout/listener, doctor and HTTP driver:

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

Download bytes match the built file. Killed only this run's verified preview; confirmed the process disappeared and curl exited 7 (connection refused), removed its PID file and retained proof files.

## 8. Codex, count and final handoff

**Codex not run:** the user permits it only if every deterministic check passes. The baseline and guard-mutation checks pass, but three requested style probes fail the acceptance boundary. **Token cost: 0; no attempt this round.** No unverified model opinions were used.

- **Evidence-backed blocking findings: 1**, the remaining R2-F2 style-boundary gap (three reproductions; two confirmed to ship through a successful build).
- **Non-blocking note:** direct PostCSS dependency should be declared despite today's successful clean installs.
- Exact R2-F1 and R2-F3 are closed; the 42-case prior matrix has no remaining failures.
- This is the **final round**. Return the decision to Eng Lead: close the remaining style boundary or obtain explicit policy narrowing from Lead/Kai. Do not start another review round automatically.

The remaining FAIL is appended to the review failure log. Full command output, all 76 probe results, mutation logs, build confirmations, clean-install proof, GitHub metadata and site proof are retained under `logs/r3/` alongside this report. Both worktrees remain clean at their specified SHAs.
