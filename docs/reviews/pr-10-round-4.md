# PR #10 review, round 4

## Verdict at `1e2dfaf`: FAIL

**One evidence-backed finding remains.** The three exact R3 reproductions are fixed. All 76 R2 and R3 regression probes behave as expected, and the restored head passes the full local chain with 48 tests. However, an uninspected `define:vars` literal passes lint and builds a real forbidden CSS comment into inline style attributes. A locally literal-backed `style={x}` also ships a comment.

- [PR #10](https://github.com/kk-ai-lab/tesla-wrap-workshop/pull/10) and [issue #8](https://github.com/kk-ai-lab/tesla-wrap-workshop/issues/8).
- Reviewed head: `1e2dfaf7723086afb52613ac21b5d9679be4e65b`.
- Parent: `fbf0319e9f4b0c0f6a3eb1284e9c78e0bb1385c0`. Exactly one commit separates the parent and head.
- Base, `origin/main`, and merge-base: `7aaff63b28d8d317276fa9f49935270027b04544`. The separate base worktree remains at that SHA.
- Node v22.23.4 and npm 10.9.9.
- Review evidence collected on 2026-11-11, 14:54 to 15:07 Europe/Dublin, GMT.

Fetched the pull ref and checked out the exact head. No permanent source edits, commits, pushes, approvals, merges, or GitHub posts were made. Each requested temporary mutation was restored with `git checkout -- <file>`. Both worktrees are clean. Probe build artifacts were replaced by a final clean build before site verification.

## R4-F1: CSS-emitting attributes still let literal comments ship

This is the remaining R3-F1 embedded-style coverage problem, not a dependency or formatting finding.

### Static `define:vars` bypass

[eslint.config.js:175-186](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/1e2dfaf7723086afb52613ac21b5d9679be4e65b/eslint.config.js#L175-L186) inspects only an attribute named `style`. [Lines 155-159](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/1e2dfaf7723086afb52613ac21b5d9679be4e65b/eslint.config.js#L155-L159) handle only `set:html` and `set:text`, and [lines 224-229](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/1e2dfaf7723086afb52613ac21b5d9679be4e65b/eslint.config.js#L224-L229) do not inspect `define:vars` values. Astro turns those values into inline CSS.

Insert this into the body of `src/site/pages/index.astro`:

```astro
<style define:vars={{a:"/* hack */"}}>.x { color:var(--a); }</style>
```

The observed commands and output are:

```text
$ npm run lint
> eslint .
EXIT=0

$ npm run build
[build] Complete!
EXIT=0
```

The built `dist/index.html` contains these literal attributes on the document and its descendants:

```html
<html lang="en" style="--a: /* hack */;" ...>
<body style="--a: /* hack */;" ...>
```

This is a CSS comment in an unquoted custom-property value, not comment-looking text inside a CSS string. After parsing the built HTML, tinycss2 1.4.0 tokenization of `--a: /* hack */;` reports a `comment` token with value ` hack `. The tokenizer was installed outside the checkout for this review. PostCSS's `walkComments` reports no child comment node for this custom-property value, so that API alone is not proof that the value contains no CSS comment.

### A locally literal-backed style identifier also ships the comment

The generic walker at [eslint.config.js:62-90](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/1e2dfaf7723086afb52613ac21b5d9679be4e65b/eslint.config.js#L62-L90) visits literals under the attribute expression, but does not resolve an identifier to its local initializer. This concrete probe uses a visible local string literal:

```astro
---
const x = "/* hack */ color:red";
---
<div style={x}>probe</div>
```

The existing page frontmatter and content remain in place; the snippet shows only the insertion. `npm run lint` exits **0**, and `npm run build` exits **0**. The resulting HTML contains:

```html
<div style="/* hack */ color:red">probe</div>
```

CSS tokenization reports the real comment. General variable-value analysis remains the known limit named in the brief. This particular reproduction meets the brief's exception because the local literal demonstrably ships as a comment in a CSS attribute. It is not a second finding or a demand to solve arbitrary runtime data flow.

### Required change and guard

Reject or inspect comment-bearing literal values supplied through CSS-emitting directives such as `define:vars`. Cover the demonstrated locally literal-backed inline style too, by resolving that local literal or failing closed at the unsupported CSS input. A plain variable with an unknown external value is outside the requested general-flow guarantee.

Add real-config negative fixtures for both demonstrated cases, plus a clean `define:vars` control. Assert the named blocking rule, not merely a nonempty result. Prove that removing each new check makes its corresponding fixture fail. The primary `define:vars` reproduction alone is sufficient for FAIL.

No current test asserts either rejection. Turning off the three implemented rules does fail tests, as shown below. This is an uncovered input path, not a surviving whole-rule removal of the kind previously logged as F1 or F2.

## GitHub confirms the draft PR and successful CI

The GitHub connector returned:

```text
pull #10:
  head.sha: 1e2dfaf7723086afb52613ac21b5d9679be4e65b
  draft: true
  mergeable: true
  mergeable_state: clean
  changed_files: 28

run 43042408752:
  head_sha: 1e2dfaf7723086afb52613ac21b5d9679be4e65b
  event: pull_request
  status: completed
  conclusion: success
```

[CI run 43042408752](https://github.com/kk-ai-lab/tesla-wrap-workshop/actions/runs/43042408752) and its [check job](https://github.com/kk-ai-lab/tesla-wrap-workshop/actions/runs/43042408752/job/130597382444) have these successful steps, in order:

1. `actions/checkout@v4`
2. `actions/setup-node@v4`
3. `npm ci`
4. `npm run lint`
5. `npm run typecheck`
6. `npm test`
7. `npm run check`
8. `npm run build`

Setup and post-job steps succeeded too. The unchanged workflow still uses Node 22, triggers on `pull_request` and pushes to `main`, and sets `permissions: contents: read`. It contains no `secrets.*` use or deploy step. Actions remain pinned to version tags, not commit SHAs. That is non-blocking and unchanged this round. Green CI proves the current suite passes, not that the demonstrated literal CSS inputs are rejected.

## The full chain passes before and after the probes

Ran the following on the exact head, then reran them after restoring all source and config mutations:

| Command | Initial exit | Final exit | Key output |
|---|---:|---:|---|
| `node -v` | 0 | 0 | `v22.23.4` |
| `npm ci` | 0 | 0 | Clean installation succeeds |
| `npm run lint` | 0 | 0 | `eslint .`, no errors |
| `npm run typecheck` | 0 | 0 | `tsc --noEmit` |
| `npm test` | 0 | 0 | `4 passed` test files; `48 passed` tests |
| `npm run check` | 0 | 0 | `check: 1 wrap, 0 violations` |
| `npm run build` | 0 | 0 | Static output; `Complete!` |

The 48 tests comprise 24 comment-ban tests, 15 loader tests, 7 PNG tests, and 2 CLI tests. Dependency advisories are outside this review and were not investigated.

## Every exact R3 reproduction now fails with a named rule

| Original R3 reproduction on the real page | Lint exit | Rule |
|---|---:|---|
| `<style set:html={"/* hack */"}></style>` | 1 | D, U |
| `<div style="/* hack */ color:red">` | 1 | A |
| SCSS end-of-line `// hack` in `<style lang="scss">` | 1 | U |

Rule names used throughout the tables are:

- B: `ban-comments/ban-comments`
- H: `astro-comments/ban-html-comments`
- S: `astro-comments/ban-style-comments`
- D: `astro-comments/ban-style-set-directive`
- A: `astro-comments/ban-style-attribute-comment`
- U: `astro-comments/ban-uninspected-style`
- I: `no-irregular-whitespace`
- N: `no-undef`

Every matrix entry runs `npm run lint` on a real source file, then restores the file. New-path probes use disposable files under `src/`. Escape sequences in the tables identify actual newline, tab, and Unicode characters inserted into source.

## R2 regression matrix: 42 of 42 expected results

All previously forbidden forms fail. Bare issue and RFC URLs, single-line SPDX, and padded allowed forms still pass. Inline-disable attempts remain ineffective.

| Probe | File/context and inserted source | Lint exit | Rule |
|---|---|---:|---|
| ts-line-hack | `domain/spec.ts`: `// hack\n` | 1 | B |
| ts-block-workaround | `domain/spec.ts`: `/* workaround */\n` | 1 | B |
| ts-jsdoc | `domain/spec.ts`: `/** hack workaround */\n` | 1 | B |
| astro-html-hack | `site/pages/index.astro`: `<!-- hack -->\n` | 1 | H |
| astro-frontmatter-hack | `site/pages/index.astro`: `// hack\n` | 1 | B |
| ts-link-hack | `domain/spec.ts`: `// see https://github.com/foo/bar/issues/1 hack workaround\n` | 1 | B |
| ts-licence-hack | `domain/spec.ts`: `// Licence: this is a hack\n` | 1 | B |
| ts-bare-issue-url | `domain/spec.ts`: `// https://github.com/foo/bar/issues/1\n` | 0 | none |
| ts-spdx-MIT | `domain/spec.ts`: `// SPDX-License-Identifier: MIT\n` | 0 | none |
| ts-copyright-removed | `domain/spec.ts`: `// Copyright 2026 kk-ai-lab\n` | 1 | B |
| ts-licensed-removed | `domain/spec.ts`: `// Licensed under the MIT License\n` | 1 | B |
| ts-rights-removed | `domain/spec.ts`: `// All rights reserved.\n` | 1 | B |
| ts-spdx-trailing-hack | `domain/spec.ts`: `// SPDX-License-Identifier: MIT hack\n` | 1 | B |
| ts-block-link-plus-hack | `domain/spec.ts`: `/* https://github.com/a/b/issues/1\n hack */\n` | 1 | B |
| ts-url-fragment | `domain/spec.ts`: `// https://github.com/a/b/issues/1#hack\n` | 1 | B |
| ts-url-query | `domain/spec.ts`: `// https://github.com/a/b/issues/1?hack=1\n` | 1 | B |
| ts-url-extra-path | `domain/spec.ts`: `// https://github.com/a/b/issues/1/hack\n` | 1 | B |
| ts-evil-url | `domain/spec.ts`: `// https://evil.example/github.com/a/b/issues/1\n` | 1 | B |
| ts-gitlab-url | `domain/spec.ts`: `// https://gitlab.com/a/b/issues/1\n` | 1 | B |
| ts-padded-issue | `domain/spec.ts`: `//    https://github.com/a/b/issues/1   \n` | 0 | none |
| ts-padded-spdx | `domain/spec.ts`: `/*   SPDX-License-Identifier: MIT   */\n` | 0 | none |
| ts-padded-hack | `domain/spec.ts`: `//    hack   \n` | 1 | B |
| ts-bare-rfc-editor | `domain/spec.ts`: `// https://www.rfc-editor.org/rfc/rfc9110\n` | 0 | none |
| ts-bare-rfc-datatracker | `domain/spec.ts`: `// https://datatracker.ietf.org/doc/html/rfc9110\n` | 0 | none |
| ts-spdx-wrapped-value | `domain/spec.ts`: `/* SPDX-License-Identifier:\nMIT */\n` | 1 | B |
| ts-spdx-wrapped-hack | `domain/spec.ts`: `/* SPDX-License-Identifier:\nhack */\n` | 1 | B |
| astro-expression-comment | `site/pages/index.astro`: `{/* hack */}\n` | 1 | B |
| astro-html-no-spaces | `site/pages/index.astro`: `<!--hack-->\n` | 1 | H |
| astro-html-multiline | `site/pages/index.astro`: `<!--\nhack\n-->\n` | 1 | H |
| astro-script-comment | `site/pages/index.astro`: `<script>\n// hack\n</script>\n` | 1 | B |
| astro-style-comment | `site/pages/index.astro`: `<style>\n/* hack */\n</style>\n` | 1 | S |
| astro-html-bare-issue | `site/pages/index.astro`: `<!-- https://github.com/a/b/issues/1 -->\n` | 0 | none |
| astro-html-spdx-MIT | `site/pages/index.astro`: `<!-- SPDX-License-Identifier: MIT -->\n` | 0 | none |
| astro-html-spdx-wrapped | `site/pages/index.astro`: `<!-- SPDX-License-Identifier:\nMIT -->\n` | 1 | H |
| ts-disable-next-line | `domain/spec.ts`: `// eslint-disable-next-line ban-comments/ban-comments\n` | 1 | B |
| ts-disable-next-line-plus-hack | `domain/spec.ts`: `// eslint-disable-next-line ban-comments/ban-comments\n// hack\n` | 1 | B |
| ts-disable-file | `domain/spec.ts`: `/* eslint-disable ban-comments/ban-comments */\n// hack\n` | 1 | B |
| ts-disable-line | `domain/spec.ts`: `// eslint-disable-line ban-comments/ban-comments -- hack workaround\n` | 1 | B |
| astro-disable-both | `site/pages/index.astro`: `/* eslint-disable ban-comments/ban-comments, astro-comments/ban-html-comments */\n` | 1 | H, B |
| new-path-js | `review-scope-probes/probe.js`: `// hack` | 1 | B |
| new-path-mjs | `review-scope-probes/probe.mjs`: `// hack` | 1 | B |
| new-path-ts | `review-scope-probes/probe.ts`: `// hack` | 1 | B |

## R3 regression matrix: 34 of 34 expected results

The allowed plain-style URL and SPDX comments still pass, including a tab separator. Wrapped SPDX remains rejected.

| Probe | File/context and inserted source | Lint exit | Rule |
|---|---|---:|---|
| style-is-global | `site/pages/index.astro body`: `<style is:global>\n/* hack */\n</style>` | 1 | S |
| style-lang-scss-block | `site/pages/index.astro body`: `<style lang="scss">\n/* hack */\n</style>` | 1 | S, U |
| style-lang-css | `site/pages/index.astro body`: `<style lang="css">\n/* hack */\n</style>` | 1 | S |
| style-second-block | `site/pages/index.astro body`: `<style>.first { color: red; }</style>\n<style>/* hack */</style>` | 1 | S |
| style-nested-rule | `site/pages/index.astro body`: `<style>.outer { .inner { /* hack */ color: red; } }</style>` | 1 | S |
| style-media | `site/pages/index.astro body`: `<style>@media (min-width: 1px) { /* hack */ .x { color: red; } }</style>` | 1 | S |
| style-supports | `site/pages/index.astro body`: `<style>@supports (display: grid) { .x { /* hack */ display: grid; } }</style>` | 1 | S |
| style-layer | `site/pages/index.astro body`: `<style>@layer probe { .x { /* hack */ color: red; } }</style>` | 1 | S |
| style-nested-element | `site/pages/index.astro body`: `<div><style>/* hack */</style></div>` | 1 | S |
| style-component-slot | `site/pages/index.astro body`: `<Fragment slot="content"><style>/* hack */</style></Fragment>` | 1 | S |
| style-in-expression | `site/pages/index.astro body`: `{wraps.length > 0 && <style>/* hack */</style>}` | 1 | S |
| style-set-html | `site/pages/index.astro body`: `<style set:html={"/* hack */"}></style>` | 1 | D, U |
| inline-style-comment | `site/pages/index.astro body`: `<div style="/* hack */ color:red">probe</div>` | 1 | A |
| style-invalid-css | `site/pages/index.astro body`: `<style>.broken { color: red; /* hack */</style>` | 1 | S, U |
| style-invalid-unclosed-comment | `site/pages/index.astro body`: `<style>/* hack</style>` | 1 | S, U |
| style-css-disable-directive | `site/pages/index.astro body`: `<style>/* eslint-disable astro-comments/ban-style-comments */\n/* hack */</style>` | 1 | S |
| style-scss-line-comment | `site/pages/index.astro body`: `<style lang="scss">\n// hack\n</style>` | 1 | S, U |
| style-scss-inline-line-comment | `site/pages/index.astro body`: `<style lang="scss">.x { color: red // hack\n; }</style>` | 1 | U |
| style-spdx-control | `site/pages/index.astro body`: `<style>/* SPDX-License-Identifier: MIT */</style>` | 0 | none |
| style-issue-control | `site/pages/index.astro body`: `<style>/* https://github.com/a/b/issues/1 */</style>` | 0 | none |
| style-spdx-tab | `site/pages/index.astro body`: `<style>/* SPDX-License-Identifier:\tMIT */</style>` | 0 | none |
| style-spdx-crlf | `site/pages/index.astro body`: `<style>/* SPDX-License-Identifier:\r\nMIT */</style>` | 1 | S |
| style-spdx-u2028 | `site/pages/index.astro body`: `<style>/* SPDX-License-Identifier:\u2028MIT */</style>` | 1 | S, I |
| style-spdx-nbsp | `site/pages/index.astro body`: `<style>/* SPDX-License-Identifier:\u00a0MIT */</style>` | 1 | S, I |
| style-spdx-wrapped-hack | `site/pages/index.astro body`: `<style>/* SPDX-License-Identifier:\nhack */</style>` | 1 | S |
| html-spdx-wrapped-hack | `site/pages/index.astro body`: `<!-- SPDX-License-Identifier:\nhack -->` | 1 | H |
| ts-spdx-tab | `domain/spec.ts ts`: `/* SPDX-License-Identifier:\tMIT */\n` | 0 | none |
| html-spdx-tab | `site/pages/index.astro body`: `<!-- SPDX-License-Identifier:\tMIT -->` | 0 | none |
| ts-spdx-crlf | `domain/spec.ts ts`: `/* SPDX-License-Identifier:\r\nMIT */\n` | 1 | B |
| html-spdx-crlf | `site/pages/index.astro body`: `<!-- SPDX-License-Identifier:\r\nMIT -->` | 1 | H |
| ts-spdx-u2028 | `domain/spec.ts ts`: `/* SPDX-License-Identifier:\u2028MIT */\n` | 1 | B, I |
| html-spdx-u2028 | `site/pages/index.astro body`: `<!-- SPDX-License-Identifier:\u2028MIT -->` | 1 | H, I |
| ts-spdx-nbsp | `domain/spec.ts ts`: `/* SPDX-License-Identifier:\u00a0MIT */\n` | 1 | B, I |
| html-spdx-nbsp | `site/pages/index.astro body`: `<!-- SPDX-License-Identifier:\u00a0MIT -->` | 1 | H, I |

## Fresh matrix: 25 probes

All probes use `src/site/pages/index.astro`. Plain CSS, `lang="css"`, ordinary style objects, and `class:list` remain valid controls. Case variants and padded `lang` values fail closed rather than silently selecting another language.

| Probe | Inserted source | Lint exit | Rule | Decision |
|---|---|---:|---|---|
| lang-upper | `<style lang="CSS">.x { color:red; }</style>` | 1 | U | Rejected |
| lang-padded | `<style lang=" css ">.x { color:red; }</style>` | 1 | U | Rejected |
| lang-dynamic-scss | `<style lang={"scss"}>.x { color:red; }</style>` | 1 | U | Rejected |
| lang-empty | `<style lang="">.x { color:red; }</style>` | 1 | U | Rejected |
| style-is-inline | `<style is:inline>/* hack */</style>` | 1 | S | Rejected |
| style-is-global | `<style is:global>/* hack */</style>` | 1 | S | Rejected |
| style-set-text | `<style set:text={"/* hack */"}></style>` | 1 | D, U | Rejected |
| style-set-html-variable | `Frontmatter: const x = "/* hack */";\n Body: <style set:html={x}></style>` | 1 | D, U | Rejected |
| style-object-clean | `<div style={{color:"red"}}>probe</div>` | 0 | none | Allowed control |
| style-object-comment | `<div style={{color:"red /* hack */"}}>probe</div>` | 1 | A | Rejected |
| style-template-comment | `` <div style={`/* hack */ color:red`}>probe</div> `` | 1 | A | Rejected |
| style-expression-comment | `<div style={"/* hack */"}>probe</div>` | 1 | A | Rejected |
| style-variable-comment | `Frontmatter: const x = "/* hack */ color:red";\n Body: <div style={x}>probe</div>` | 0 | none | Literal shipment confirmed; same R4-F1 reproduction. General variable flow is a known limit. |
| class-list-control | `<div class:list={["/* hack */"]}>probe</div>` | 0 | none | Allowed control |
| style-define-vars | `<style define:vars={{a:"/* hack */"}}>.x { color:var(--a); }</style>` | 0 | none | R4-F1; literal CSS comment ships |
| style-uppercase | `<STYLE>/* hack */</STYLE>` | 1 | N | Rejected |
| style-in-svg | `<svg><style>/* hack */</style></svg>` | 1 | S | Rejected |
| component-style-comment | `<Fragment style="/* hack */ color:red">probe</Fragment>` | 1 | A | Rejected |
| style-entity-comment | `<div style="&#47;* hack *&#47; color:red">probe</div>` | 1 | A | Rejected before CI build; decoded comment ships only if lint is bypassed |
| stylesheet-data-url | `<link rel="stylesheet" href="data:text/css,%2F%2A%20hack%20%2A%2F%20body%7Bcolor%3Ared%7D">` | 0 | none | Decoded CSS comment ships; separate stylesheet-transport policy note below |
| style-plain-control | `<style>.probe { color:red; }</style>` | 0 | none | Allowed control |
| style-lang-css-control | `<style lang="css">.probe { color:red; }</style>` | 0 | none | Allowed control |
| style-spdx-control | `<style>/* SPDX-License-Identifier: MIT */</style>` | 0 | none | Allowed control |
| style-issue-control | `<style>/* https://github.com/a/b/issues/1 */</style>` | 0 | none | Allowed control |
| style-rfc-control | `<style>/* https://www.rfc-editor.org/rfc/rfc9110 */</style>` | 0 | none | Allowed control |

### Confirmed build behavior for the observed passes

| Probe | Lint exit | Build exit | Built evidence | Review treatment |
|---|---:|---:|---|---|
| `define:vars` literal | 0 | 0 | `style="--a: /* hack */;"`, real CSS comment token | R4-F1 |
| Local literal behind `style={x}` | 0 | 0 | `style="/* hack */ color:red"`, real CSS comment token | Additional R4-F1 reproduction under the literal-shipment exception |
| Encoded static style attribute | 1 | 0 | Raw HTML retains `&#47;`; HTML decoding produces `/* hack */ color:red` | Not a bypass. Lint blocks it before CI build. |
| CSS stylesheet data URL | 0 | 0 | The encoded CSS URL survives in `dist/index.html`; decoding yields `/* hack */ body{color:red}` and a real CSS comment token | Confirmed separate CSS transport limit, not another blocking finding in this R3-F1 style-element/attribute scope |

The data URL is an inline stylesheet resource, not a comment node in the Astro source or an input to the three style rules. It deserves a policy decision if the project intends to ban comment payloads in every possible stylesheet transport. This review does not broaden the remaining style-element and style-attribute finding into a general resource-content policy. The built payload is recorded rather than dismissed as a harmless string. No network request was needed to decode it.

The uppercase `<STYLE>` probe fails with `no-undef`, not a custom comment rule. It is not a silent lint escape. HTML entity encoding is handled by the attribute rule because the Astro AST exposes the decoded value. A comment in a component's `style` attribute also fails, as does a style block under SVG.

## All three whole-rule mutations fail tests

Each mutation changed only the real `eslint.config.js`. Ran `npm test -- --reporter=verbose`, captured the failing tests, then restored the config and confirmed a clean working tree.

| Mutation of the real config | Test exit | Failed / passed tests | Result |
|---|---:|---|---|
| directive-off | 1 | 1 / 47 | Kills the named set-directive guard test |
| attribute-off | 1 | 2 / 46 | Kills both static and dynamic attribute guard tests |
| uninspected-off | 1 | 2 / 46 | Kills both SCSS guard tests |
| directive-drop-set-text | 0 | 0 / 48 | Survives; no dedicated set:text fixture |
| attribute-drop-template-literal | 0 | 0 / 48 | Survives; dynamic fixture uses a normal string, not a template literal |
| lang-case-insensitive | 0 | 0 / 48 | Survives; case-normalization policy has no fixture |
| uninspected-drop-lang-check | 1 | 2 / 46 | Kills both SCSS guard tests |

The claimed **1, 2, 2** failure counts are correct. The exact failed tests are:

- D off: `fails lint for set:html on a style element`.
- A off: `fails lint for a static style attribute comment` and `fails lint for a dynamic style attribute comment`.
- U off: `fails lint for a style element with lang scss` and `fails lint for a scss line comment in a style element`.

The branch weakenings that survive are coverage notes, not extra FAIL items. The unmodified head rejects the template-literal and set:text probes. Case-insensitive acceptance of clean `lang="CSS"` is a policy change rather than proof of a comment escape. Dedicated template-literal and set:text fixtures would improve coverage.

## New guards catch all three original R3 cases

| New guard and test location | Original problem it catches | Proof |
|---|---|---|
| D, `eslint.config.js:141-164`; `test/comment-ban.test.ts:77-82` | Injected `<style set:html=...>` content | Real-source lint exits 1 with D; D-off mutation fails 1 test |
| A, `eslint.config.js:166-191`; tests 84-96 | Static inline CSS comments, plus direct dynamic string literals | Real-source lint exits 1 with A; A-off mutation fails 2 tests |
| U, `eslint.config.js:210-235`; tests 98-110 | Unsupported SCSS syntax, including end-of-line comments | Real-source lint exits 1 with U; U-off mutation fails 2 tests |

The negative tests assert `result.messages.map(message => message.ruleId)` contains the exact intended rule ID. A second rule or parse error cannot substitute for the guard being tested. The positive fixtures require both zero errors and an empty messages array.

## Fixtures stay out of normal lint and the site

`new ESLint().lintFiles(["."])` with the real config reports **16 linted files, 0 fixture files, and 0 errors**. The exclusion test at `test/comment-ban.test.ts:161-174` requires both absence of the ban rule and an actual ignored-file message. It does not merely accept an empty result.

After restoring the page, the final build has only these files, enumerated with `rg --files dist`:

```text
dist/index.html
dist/wraps/sample-solid-grey/Solid Grey.png
```

No `test/lint-fixtures` file or injected probe remains in `dist`. Fixtures are loaded through the ESLint test harness, not through Astro routes.

## Verification skill passes on the restored head

Read and followed `.cursor/skills/verify-wrap-workshop/SKILL.md`. Started a new direct Node 22 preview for this run, verified its PID, checkout, and listening socket, and ran the doctor and live download check:

```text
HTTP/1.1 200 OK
node -v: v22.23.4

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

The downloaded bytes match the built sample. Stopped only the preview started for this review. Its process disappeared, curl exited 7 because the port refused connections, and the PID file was removed. The skill's two proof files remain.

## The scoped diff has 11 files; the PR has 28

`git diff --name-status fbf0319 HEAD`:

```text
M	eslint.config.js
M	package-lock.json
M	package.json
M	test/comment-ban.test.ts
A	test/lint-fixtures/style-attr-dynamic.astro
A	test/lint-fixtures/style-attr-plain.astro
A	test/lint-fixtures/style-attr-static.astro
A	test/lint-fixtures/style-lang-scss-line.astro
A	test/lint-fixtures/style-lang-scss.astro
A	test/lint-fixtures/style-plain.astro
A	test/lint-fixtures/style-set-html.astro
```

`git diff --name-status origin/main...HEAD`:

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
A	test/lint-fixtures/style-attr-dynamic.astro
A	test/lint-fixtures/style-attr-plain.astro
A	test/lint-fixtures/style-attr-static.astro
A	test/lint-fixtures/style-comment.astro
A	test/lint-fixtures/style-lang-scss-line.astro
A	test/lint-fixtures/style-lang-scss.astro
A	test/lint-fixtures/style-plain.astro
A	test/lint-fixtures/style-set-html.astro
```

The 28-file count matches the GitHub connector. There are seven new fixtures this round. There is no file-count discrepancy.

These commands exit 0:

```bash
git diff --exit-code fbf0319 HEAD -- src docs .github
git diff --exit-code 7aaff63 HEAD -- src docs
```

The only `package.json` and lockfile delta since R3 is the root declaration of `"postcss": "8.5.32"` in `devDependencies`. Comparing the parsed lockfile maps proves **zero new package entries, zero removed entries, and zero changes to existing package entries**. Only the root package metadata changes. PostCSS already resolves at `node_modules/postcss` to 8.5.32 from `https://registry.npmjs.org/postcss/-/postcss-8.5.32.tgz` with a SHA-512 integrity hash. `npm ls postcss` succeeds, and the final clean `npm ci` followed by lint succeeds. The prior undeclared-dependency note is closed.

The scoped diff adds no production workaround or hack comments. The comment-bearing fixture contents are intentional test data. No assertions were loosened, and no `.skip` or `.only` was added. The existing tests are unchanged except for the new cases. There are no unrelated source, documentation, or workflow edits.

## Codex and next step

Codex was **not run**. The condition that every deterministic acceptance check pass is not met because a forbidden CSS literal passes lint and ships. **Token cost: 0, no attempt.** There are no unverified model opinions in this report.

- Evidence-backed blocking findings: **1**, remaining R3-F1, with a primary `define:vars` reproduction and a literal-backed inline-style reproduction.
- The three exact R3 failures are fixed. All 76 prior regression probes pass, and the baseline has 48 passing tests.
- Non-blocking notes are the surviving branch mutations and the separately confirmed stylesheet data-URL transport limit. The PostCSS declaration issue is closed.
- The remaining finding is appended to `fail-log.tsv`. It continues the embedded-CSS coverage class, not a surviving removal of one of the three implemented rules.

Next step: return the evidence to Eng Lead. Close the literal CSS input path with a real-config regression guard, or obtain Kai's explicit approval to narrow the comment policy. No code fix, policy change, or further review round was started here.

Full command output, probe payloads, built HTML snapshots, CSS token evidence, GitHub metadata, mutation failures, fixture checks, and site verification output remain in `logs/r4/` beside this report. The report itself includes the evidence needed to read the verdict on GitHub.
