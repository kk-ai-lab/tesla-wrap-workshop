# PR #12 final review, round 2

## Verdict at `b866c34`: PASS

**PASS within the requested final-round scope.** R1 findings F1-F4 are fixed and their new guards are mutation-proven. All 79 build-and-scan probes have the expected outcomes under the current contract. The full chain and verification skill pass with 77 tests. There are **zero new evidence-backed findings**.

F5 is deferred by Lead and is not a gate. The head nevertheless rejects the original symlink reproduction. The `srcdoc` iframe probe is recorded only, as requested; its nested HTML is not scanned. This PASS does not claim that deferred or record-only cases have been brought into the scanner's guarantee.

- [PR #12](https://github.com/kk-ai-lab/tesla-wrap-workshop/pull/12), closing [issue #11](https://github.com/kk-ai-lab/tesla-wrap-workshop/issues/11).
- Exact reviewed head: `b866c34a14cdc1138dbf29b76ff2e4b1c1c65b06`.
- Main and the separate base worktree: `b7a2fa3a17ccb4fa5a969e0cfdcb995baf16e0b1`.
- Comparison head from R1: `7fdca61f0b0fe4da7666808bffe6a129c9f5be7a`.
- Node v22.23.4, npm 10.9.9.
- Review performed 2026-11-11, approximately 16:10 to 16:28 Europe/Dublin, GMT.

Fetched the pull ref and main, then checked out the exact SHA. No permanent code edits, commits, pushes, posts, approvals, or merges. Temporary source/config mutations were restored after each run. The head and base worktrees are clean, and final `dist/` is a pristine build.

## GitHub confirms the claimed PR and CI state

The connector returned:

```text
PR #12:
  head.sha: b866c34a14cdc1138dbf29b76ff2e4b1c1c65b06
  draft: true
  mergeable: true
  mergeable_state: clean
  changed_files: 41

CI run 43055188565:
  head_sha: b866c34a14cdc1138dbf29b76ff2e4b1c1c65b06
  event: pull_request
  status: completed
  conclusion: success
```

[Run 43055188565](https://github.com/kk-ai-lab/tesla-wrap-workshop/actions/runs/43055188565) reports every job step successful. The npm steps run in this order:

```text
npm ci
npm run lint
npm run typecheck
npm test
npm run check
npm run build
npm run check:dist
```

The workflow is unchanged from R1. It still uses Node 22 and read-only `contents: read` permission. `action-validator` and `actionlint` both exit 0 on the restored workflow. No workflow, dependency, or source-page change is hidden in this round's delta.

## Each original finding now has a named rejection

Each probe builds before scanning. Public assets are confirmed copied byte-for-byte. The real-page probes use `src/site/pages/index.astro` and restore it afterward.

| R1 finding / reproduction | R1 scan exit | R2 build exit | R2 scan exit | R2 finding |
|---|---:|---:|---:|---|
| F1 HTML comment under noscript | 0 | 0 | 1 | `html comment in review-probe/probe.html` |
| F1 CSS comment under noscript | 0 | 0 | 1 | `css comment in review-probe/probe.html` |
| F2 real-page onclick comment | 0 | 0 | 1 | `js comment in index.html` |
| F3 raw public HTML ending in `<div title="unfinished` | 0 | 0 | 1 | `parse error in review-probe/probe.html: eof-in-tag` |
| F4 `.mjs` and `.cjs` assets | 0 | 0 | 1 | JS comment and the corresponding filename |
| F4 `.HTML` and `.CSS` assets | 0 | 0 | 1 | HTML/CSS comment and the corresponding filename |
| F4 module and stylesheet referenced by the real page | 0 | 0 | 1 | CSS comment in `review-fresh/probe.CSS`; JS comment in `review-fresh/probe.mjs` |
| F5 directory symlink, deferred | 0 | 0 | 1 | `parse error in review-link: symlink` |

### F3 also works through Astro set:html

Inserted this into the real page, rather than asking Astro to compile malformed source markup:

```astro
<Fragment set:html={'<div title="unfinished'} />
```

Observed:

```text
$ npm run build
[build] Complete!
EXIT=0

$ npm run check:dist
parse error in index.html: unexpected-solidus-in-tag
parse error in index.html: unexpected-solidus-in-tag
parse error in index.html: unexpected-solidus-in-tag
parse error in index.html: unexpected-character-in-attribute-name
EXIT=1
```

The following page markup follows the injected partial tag, so this case produces attribute/tag errors rather than the public file's EOF diagnostic. Both paths are rejected. No raw malformed Astro source had to compile.

### F5 status, without making it a gate

The original post-build directory-link probe now exits 1 with reason `symlink`. The head includes a corresponding test. This is recorded behavior only; the review honors Lead's deferral and does not require further filesystem-link coverage.

## Zero tolerated HTML errors still permits the real build

[recordParseErrors, lines 238-242](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/b866c34a14cdc1138dbf29b76ff2e4b1c1c65b06/scripts/check-dist.ts#L238-L242) records every parse5 error code. There is no tolerated-code list or filtering branch. Both document and fragment parsing collect diagnostics and pass them to that function.

Independent parsing of the final real output reports:

```json
{"file":"dist/index.html","bytes":245,"parse5ErrorCount":0,"errors":[]}
```

Thus the pristine pass is not caused by ignoring selected HTML errors. The malformed-HTML test fails if error recording is disabled.

## Full Node 22 chain passes before and after mutation testing

| Command | Initial exit | Restored exit | Key output |
|---|---:|---:|---|
| `node -v` | 0 | 0 | `v22.23.4` |
| `npm ci` | 0 | 0 | Clean installs succeed |
| `npm run lint` | 0 | 0 | `eslint .`, no errors |
| `npm run typecheck` | 0 | 0 | `tsc --noEmit` |
| `npm test` | 0 | 0 | 5 test files; **77 passed** |
| `npm run check` | 0 | 0 | `check: 1 wrap, 0 violations` |
| `npm run build` | 0 | 0 | Static output; `Complete!` |
| `npm run check:dist` | 0 | 0 | No scanner findings |

Also ran `npm run check:dist -- ../base/dist`, which exits 0 against main's built output. Main's sources remain unchanged. The 77 tests comprise the prior 68 plus nine new dist tests, seven negative and two positive.

## Mutation counts are independently reproduced

Each row runs the full `npm test -- --reporter=verbose` suite. Each mutation is reverted with `git checkout -- <file>`, and a clean worktree is confirmed before the next row.

| Mutation | Test exit | Failed / passed tests |
|---|---:|---:|
| F1-noscript-off | 1 | 2 / 75 |
| F2-event-off | 1 | 1 / 76 |
| F3-html-errors-off | 1 | 1 / 76 |
| F4-all-extension-guards-off | 1 | 2 / 75 |
| F4-case-sensitive | 1 | 1 / 76 |
| F4-mjs-cjs-off | 1 | 1 / 76 |
| F4-unknown-pass | 1 | 1 / 76 |
| R1-scanRoot-off | 1 | 16 / 61 |
| R1-HTML-off | 1 | 11 / 66 |
| R1-CSS-off | 1 | 8 / 69 |
| R1-JS-off | 1 | 4 / 73 |
| R1-style-attribute-off | 1 | 3 / 74 |
| R1-exception-parse-errors-pass | 1 | 2 / 75 |
| R1-CI-step-removed | 1 | 1 / 76 |
| R1-CI-order-reversed | 1 | 1 / 76 |
| R1-lint-set-text-off | 1 | 1 / 76 |
| R1-lint-template-off | 1 | 1 / 76 |
| R1-lint-lang-case-weakened | 1 | 1 / 76 |
| allowlist-empty | 1 | 6 / 71 |

Build's claimed **F1 2, F2 1, F3 1, F4 2** failure counts match.

The F4 combined mutation restores case-sensitive suffix lookup, removes `.mjs` and `.cjs`, and removes the unknown-extension finding. It kills the extension-language test and the unknown-extension test. The three independent weakens each kill one test too. Case-sensitive and missing-module variants can still fail closed as unknown extensions; the tests require the actual expected comment-language diagnostics, so a generic failure cannot substitute for correct dispatch.

The earlier root mutation now kills 16 tests rather than R1's nine because seven new negative tests were added. The per-type counts increase for the same reason. The exception-path mutation kills the broken CSS and JS tests; the separate F3 mutation kills the new HTML-diagnostic test. CI deletion and reversal of build/scan order both remain caught. The source-lint set:text, template-literal, and lang-case tests remain sensitive.

## The allowlisted HTML fixture still tests pass-through

Exact `git diff 7fdca61 HEAD -- test/lint-fixtures/check-dist/allow-html/index.html`:

```diff
diff --git a/test/lint-fixtures/check-dist/allow-html/index.html b/test/lint-fixtures/check-dist/allow-html/index.html
index bf78514..393c497 100644
--- a/test/lint-fixtures/check-dist/allow-html/index.html
+++ b/test/lint-fixtures/check-dist/allow-html/index.html
@@ -1 +1 @@
-<!-- https://github.com/kk-ai-lab/tesla-wrap-workshop/issues/11 -->
+<!DOCTYPE html><html><body><!-- https://github.com/kk-ai-lab/tesla-wrap-workshop/issues/11 --></body></html>
```

The full HTML comment token is byte-identical before and after:

```html
<!-- https://github.com/kk-ai-lab/tesla-wrap-workshop/issues/11 -->
```

The change adds a valid HTML document wrapper. It does not remove or alter the allowed comment. Independent parse5 inspection of the new fixture finds exactly one comment and zero parse errors.

The unchanged test at [test/check-dist.test.ts:73-75](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/b866c34a14cdc1138dbf29b76ff2e4b1c1c65b06/test/check-dist.test.ts#L73-L75) calls `expectExit(..., 0, "")`. Its helper asserts CLI exit 0 and empty stdout for that fixture. The comment remains present in the file under test.

Emptied the shared module's pattern array, without editing the fixture or its test:

```text
Normal patterns:
  direct fixture scan exit 0, stdout empty

Empty patterns:
  direct fixture scan exit 1
  html comment in index.html
  npm test: 6 failed, 71 passed
  the allowlisted-HTML test is one of the failures

Restored patterns:
  direct fixture scan exit 0, stdout empty
```

The six failures comprise HTML/CSS/JS output allowlist controls and source-lint allowlist controls. This proves that the fixture's success depends on the shared allowlist rather than on a missing comment or an inactive scanner.

The shared policy module is unchanged since R1, and its regex sources still match main byte-for-byte. Both lint and the scanner still import it. No allowlist widening occurred.

## Regression build matrix: 48 R1 cases

Every entry builds successfully and then scans. Unknown file formats that passed silently in R1 now fail closed, as explicitly intended for this round. That includes `.map`, `.json`, `.xml`, `.svg`, plain text, odd suffixes, and extensionless files. These rejections are not findings.

| Probe | Built input | Build exit | Scan exit | Key output |
|---|---|---:|---:|---|
| r4-define-vars | `<style define:vars={{a:"/* hack */"}}>.x { color:var(--a); }</style>` | 0 | 1 | css comment in index.html |
| r4-frontmatter-style | `const x = "/* hack */ color:red";\n<div style={x}>probe</div>` | 0 | 1 | css comment in index.html |
| r3-set-html | `<style set:html={"/* hack */"}></style>` | 0 | 1 | css comment in index.html |
| r3-style-attribute | `<div style="/* hack */ color:red">probe</div>` | 0 | 1 | css comment in index.html |
| inline-script | `<script is:inline>/* hack */ globalThis.__review = 1;</script>` | 0 | 1 | js comment in index.html |
| js-string | `const x = "/* not a comment */";` | 0 | 0 | No findings |
| js-template | `` const x = `/* not a comment */`; `` | 0 | 0 | No findings |
| js-regex | `const x = /[/*]/;` | 0 | 0 | No findings |
| css-string | `.x {font-family:"/* not a comment */";}` | 0 | 0 | No findings |
| css-url | `.x {background:url(https://example.test/a/*/b);}` | 0 | 0 | No findings |
| css-content | `.x::before {content:"/*";}` | 0 | 0 | No findings |
| html-text-escaped | `<!DOCTYPE html><p>&lt;!-- hack --&gt;</p>` | 0 | 0 | No findings |
| allowed-html | `<!DOCTYPE html><!-- https://github.com/a/b/issues/1 --><!-- https://www.rfc-editor.org/rfc/rfc9110 --><!-- SPDX-License-Identifier: MIT -->` | 0 | 0 | No findings |
| allowed-css | `/* https://github.com/a/b/issues/1 */\n/* https://www.rfc-editor.org/rfc/rfc9110 */\n/* SPDX-License-Identifier: MIT */` | 0 | 0 | No findings |
| allowed-js | `// https://github.com/a/b/issues/1\n// https://www.rfc-editor.org/rfc/rfc9110\n// SPDX-License-Identifier: MIT` | 0 | 0 | No findings |
| extension-mjs | `/* hack */ export const x=1;` | 0 | 1 | js comment in review-probe/probe.mjs |
| extension-cjs | `/* hack */ module.exports=1;` | 0 | 1 | js comment in review-probe/probe.cjs |
| extension-map | `{"version":3,"sourcesContent":["/* string data */"]}` | 0 | 1 | parse error in review-probe/probe.map: unknown extension |
| extension-svg | `<svg xmlns="http://www.w3.org/2000/svg"><!-- hack --><style>/* hack */</style></svg>` | 0 | 1 | parse error in review-probe/probe.svg: unknown extension |
| extension-xml | `<?xml version="1.0"?><root><!-- hack --></root>` | 0 | 1 | parse error in review-probe/probe.xml: unknown extension |
| extension-json | `{"text":"/* string data */"}` | 0 | 1 | parse error in review-probe/probe.json: unknown extension |
| extension-txt | `/* arbitrary text */` | 0 | 1 | parse error in review-probe/probe.txt: unknown extension |
| extension-odd | `/* text of unspecified type */` | 0 | 1 | parse error in review-probe/probe.odd: unknown extension |
| extension-none | `/* text of unspecified type */` | 0 | 1 | parse error in review-probe/probe: unknown extension |
| extension-HTML | `<!DOCTYPE html><!-- hack --><p>probe</p>` | 0 | 1 | html comment in review-probe/probe.HTML |
| extension-CSS | `/* hack */ .x {color:red;}` | 0 | 1 | css comment in review-probe/probe.CSS |
| inline-svg-style | `<!DOCTYPE html><svg><style>/* hack */</style></svg>` | 0 | 1 | css comment in review-probe/probe.html |
| inline-svg-comment | `<!DOCTYPE html><svg><!-- hack --></svg>` | 0 | 1 | html comment in review-probe/probe.html |
| noscript-comment | `<!DOCTYPE html><html><head></head><body><noscript><!-- hack --><p>fallback</p></noscript></body></html>` | 0 | 1 | html comment in review-probe/probe.html |
| noscript-style | `<!DOCTYPE html><html><head></head><body><noscript><style>/* hack */</style></noscript></body></html>` | 0 | 1 | css comment in review-probe/probe.html |
| template-comment | `<!DOCTYPE html><template><!-- hack --></template>` | 0 | 1 | html comment in review-probe/probe.html |
| module-script | `<!DOCTYPE html><script type="module">/* hack */ export const x=1;</script>` | 0 | 1 | js comment in review-probe/probe.html |
| script-json-valid | `<!DOCTYPE html><script type="application/json">{"value":"/* string data */"}</script>` | 0 | 0 | No findings |
| script-json-invalid-comment | `<!DOCTYPE html><script type="application/json">{/* hack */ "value":1}</script>` | 0 | 0 | No findings |
| script-ldjson-invalid-comment | `<!DOCTYPE html><script type="application/ld+json">{/* hack */ "value":1}</script>` | 0 | 0 | No findings |
| script-text-template | `<!DOCTYPE html><script type="text/template"><!-- hack --></script>` | 0 | 1 | parse error in review-probe/probe.html: unsupported script type |
| conditional-ie | `<!DOCTYPE html><!--[if IE]><p>legacy</p><![endif]-->` | 0 | 1 | html comment in review-probe/probe.html |
| script-html-looking-string | `<!DOCTYPE html><script>const x = "<!-- not a comment -->";</script>` | 0 | 0 | No findings |
| preserved-css | `/*! hack */.x{color:red}` | 0 | 1 | css comment in review-probe/probe.css |
| import-css | `@import /* hack */ "x.css";` | 0 | 1 | css comment in review-probe/probe.css |
| fontface-css | `@font-face{font-family:x;/* hack */src:url(x.woff2)}` | 0 | 1 | css comment in review-probe/probe.css |
| js-hashbang | `#!/usr/bin/env node\nconst x=1;` | 0 | 1 | js comment in review-probe/probe.js |
| js-html-comment | `<!-- hack\nconst x=1;` | 0 | 1 | js comment in review-probe/probe.js |
| js-jsx | `const x=<div/>;` | 0 | 1 | parse error in review-probe/probe.js: Unexpected token (1:8) |
| html-eof-tag | `<!DOCTYPE html><html><head></head><body><div title="unfinished` | 0 | 1 | parse error in review-probe/probe.html: eof-in-tag |
| html-invalid-comment | `<!DOCTYPE html><!-- hack` | 0 | 1 | parse error in review-probe/probe.html: eof-in-comment; html comment in review-probe/probe.html |
| huge-js | `(8 MiB spaces) /* hack */` | 0 | 1 | js comment in review-probe/probe.js |
| symlink-directory | `Directory symlink to an owned JS-comment target` | 0 | 1 | parse error in review-link: symlink |

The R3/R4 define:vars, local literal into style, set:html, direct style attribute, and inline-script reproductions still fail with the correct comment finding after successful builds. All string, template-literal, regex-literal, CSS-string, CSS-url, escaped-HTML-text, and shared-allowlist controls pass. JS strings containing `<!--` do not produce false positives.

## Fresh build matrix: 31 cases

The first three rows add the real-page F2/F3/F4 checks. The remaining rows cover the requested new boundaries. All results match the agreed expectations.

| Probe | Input or control | Build exit | Scan exit | Key output |
|---|---|---:|---:|---|
| F2-real-handler | `<button onclick="/* hack */ globalThis.__review=1">probe</button>` | 0 | 1 | js comment in index.html |
| F3-malformed-set-html | `<Fragment set:html={'<div title="unfinished'} />` | 0 | 1 | parse error in index.html: unexpected-solidus-in-tag; parse error in index.html: unexpected-character-in-attribute-name |
| F4-referenced-module-css | `<script is:inline type="module" src="/review-fresh/probe.mjs"></script><link rel="stylesheet" href="/review-fresh/probe.CSS">` | 0 | 1 | css comment in review-fresh/probe.CSS; js comment in review-fresh/probe.mjs |
| handler-entities | `<!DOCTYPE html><button onclick="&#47;* hack *&#47;">probe</button>` | 0 | 1 | js comment in review-fresh/probe.html |
| handler-return | `<!DOCTYPE html><button onclick="return false;">probe</button>` | 0 | 0 | No findings |
| handler-await | `<!DOCTYPE html><button onclick="await Promise.resolve();">probe</button>` | 0 | 1 | parse error in review-fresh/probe.html: Unexpected token (2:6) |
| handler-empty | `<!DOCTYPE html><button onclick="">probe</button>` | 0 | 0 | No findings |
| handler-uppercase | `<!DOCTYPE html><button ONCLICK="/* hack */">probe</button>` | 0 | 1 | js comment in review-fresh/probe.html |
| handler-string-control | `<!DOCTYPE html><button onclick="console.log('/* data */')">probe</button>` | 0 | 0 | No findings |
| noscript-nested-element | `<!DOCTYPE html><section><div><noscript><!-- hack --></noscript></div></section>` | 0 | 1 | html comment in review-fresh/probe.html |
| noscript-nested-noscript | `<!DOCTYPE html><noscript><noscript><!-- hack --></noscript></noscript>` | 0 | 1 | parse error in review-fresh/probe.html: end-tag-without-matching-open-element; parse error in review-fresh/probe.html: eof-in-element-that-can-contain-only-text; html comment in review-fresh/probe.html |
| noscript-head-style | `<!DOCTYPE html><html><head><noscript><style>/* hack */</style></noscript></head><body></body></html>` | 0 | 1 | css comment in review-fresh/probe.html |
| noscript-head-link | `<!DOCTYPE html><html><head><noscript><link rel="stylesheet" href="/review-fresh/good.css"></noscript></head><body></body></html>` | 0 | 0 | No findings |
| noscript-head-link-comment | `<!DOCTYPE html><html><head><noscript><link rel="stylesheet" href="/review-fresh/good.css"><!-- hack --></noscript></head><body></body></html>` | 0 | 1 | html comment in review-fresh/probe.html |
| noscript-clean-control | `<!DOCTYPE html><section><noscript><p>fallback</p></noscript></section>` | 0 | 0 | No findings |
| opaque-PNG | `Opaque .PNG suffix control, 3154 bytes` | 0 | 0 | No findings |
| opaque-Png | `Opaque .Png suffix control, 3154 bytes` | 0 | 0 | No findings |
| opaque-woff2 | `Opaque .woff2 suffix control, 24 bytes` | 0 | 0 | No findings |
| unknown-svg | `<svg><!-- hack --></svg>` | 0 | 1 | parse error in review-fresh/probe.svg: unknown extension |
| unknown-txt | `arbitrary plain text` | 0 | 1 | parse error in review-fresh/probe.txt: unknown extension |
| no-extension | `plain output` | 0 | 1 | parse error in review-fresh/probe: unknown extension |
| dotfile | `plain output` | 0 | 1 | parse error in review-fresh/.review: unknown extension |
| template-content | `<!DOCTYPE html><template><style>/* hack */</style><!-- hack --></template>` | 0 | 1 | css comment in review-fresh/probe.html; html comment in review-fresh/probe.html |
| script-ldjson | `<!DOCTYPE html><script type="application/ld+json">{"value":"/* data */"}</script>` | 0 | 0 | No findings |
| script-json | `<!DOCTYPE html><script type="application/json">{"value":"/* data */"}</script>` | 0 | 0 | No findings |
| script-importmap | `<!DOCTYPE html><script type="importmap">{"imports":{}}</script>` | 0 | 0 | No findings |
| script-speculationrules | `<!DOCTYPE html><script type="speculationrules">{}</script>` | 0 | 0 | No findings |
| script-text-template | `<!DOCTYPE html><script type="text/template"><p>content</p></script>` | 0 | 1 | parse error in review-fresh/probe.html: unsupported script type |
| script-unknown-type | `<!DOCTYPE html><script type="application/x-custom">data</script>` | 0 | 1 | parse error in review-fresh/probe.html: unsupported script type |
| script-html-string | `<!DOCTYPE html><script>const x="<!-- not a comment -->";</script>` | 0 | 0 | No findings |
| srcdoc-record-only | `<!DOCTYPE html><iframe srcdoc="&lt;!-- hack --&gt;"></iframe>` | 0 | 0 | No findings |

### Interpretation of the fresh cases

- Numeric HTML entities in onclick decode to a real `/* hack */` and are caught as JS comments. Uppercase `ONCLICK` is caught too.
- `return false` and an empty handler pass. A comment-looking handler string passes.
- `await Promise.resolve()` fails with `Unexpected token (2:6)` in the function-body wrapper. A native inline handler is not an async function. Rejecting this syntax is the requested fail-closed behavior, not a false-positive finding. The reported line refers to the generated wrapper.
- Noscript content is inspected under ordinary elements and in the head. A clean fallback and a clean head link pass. Comment-bearing head style/link cases fail. Nested noscript reports both malformed-nesting errors and the HTML comment, so it does not escape inspection.
- `.PNG` and `.Png` controls use the real sample PNG. The `.woff2` case tests the declared opaque-suffix exemption, not font-format validation. All pass. `.svg`, `.txt`, a suffixless file, and a dotfile fail with `unknown extension`, by design.
- Template content is scanned for both CSS and HTML comments.
- JSON, JSON-LD, importmap, and speculationrules script types remain known non-JS data blocks and are skipped. Their data syntax is not validated by the JS scanner. Unknown script types, including text/template, fail with `unsupported script type`.

### srcdoc is recorded only

The iframe case builds and scans with exit 0. Its HTML attribute decodes to `<!-- hack -->`; independently parsing that nested document finds a real comment. The scanner does not inspect `srcdoc` today.

This is the record-only limit requested in the brief, not a new FAIL item or a claim that the nested document has been checked. Link data URLs, runtime-fetched content, and npm audit also remain outside this review.

## New guards catch their original findings

| Guard | Original finding caught | Head evidence | Mutation evidence |
|---|---|---|---|
| Noscript text is parsed as a fragment and walked, lines 229-231 and 244-263 | F1 HTML/CSS under noscript | Both original public builds now scan 1 with the named language | F1 off: 2 failures |
| on* values parsed through a function-body wrapper, lines 136-142 and 205-211 | F2 inline handler JS | Real-page handler and entity/case variants scan 1; return/string controls pass | F2 off: 1 failure |
| Every parse5 diagnostic is recorded, lines 238-242 and 266-282 | F3 malformed HTML silently accepted | Raw public EOF and real-page set:html both scan 1; pristine real HTML has 0 parse errors | F3 off: 1 failure |
| Case-normalized HTML/CSS/JS/mjs/cjs dispatch and closed fallback, lines 53-75 and 328-348 | F4 skipped real resources | All original aliases and referenced assets scan 1 with actual language findings | Combined off: 2; each independent weakening: 1 |
| Existing CSS tokenizer and attribute inspection retained | R3-F1/R4-F1 literal CSS routes | All five original required output cases remain caught | CSS off: 8; attribute off: 3 |

F5 is deferred. The actual head now rejects a listed symlink, but this review does not expand the filesystem policy or use that status as an acceptance gate.

## Verification skill passes on the restored head

Read and followed the unchanged `.cursor/skills/verify-wrap-workshop/SKILL.md`. After the final clean install, build, and scan, started a new direct Node 22 preview. Verified its PID, working directory, and listening socket before driving the site:

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

$ npm run check:dist
[no scanner findings]
EXIT=0
```

The downloaded bytes match the built PNG. Stopped only this review's preview, confirmed its process disappeared and curl exited 7, removed the PID file, and retained all three proof files.

Normal lint enumerates 20 files, zero fixture files, and zero errors. The final dist contains only:

```text
dist/index.html
dist/wraps/sample-solid-grey/Solid Grey.png
```

No injected source, public asset, symlink, or fixture remains in that final build.

## Scope reconciliation and hygiene

Since R1, 15 files are touched: three modifications plus twelve additions. That takes the PR from 29 to 41 total changed files, matching the connector.

`git diff --name-status 7fdca61 HEAD`:

```text
M	scripts/check-dist.ts
M	test/check-dist.test.ts
M	test/lint-fixtures/check-dist/allow-html/index.html
A	test/lint-fixtures/check-dist/event-handler-return/index.html
A	test/lint-fixtures/check-dist/event-handler-string/index.html
A	test/lint-fixtures/check-dist/event-handler/index.html
A	test/lint-fixtures/check-dist/extensions/probe.CSS
A	test/lint-fixtures/check-dist/extensions/probe.HTML
A	test/lint-fixtures/check-dist/extensions/probe.JS
A	test/lint-fixtures/check-dist/extensions/probe.cjs
A	test/lint-fixtures/check-dist/extensions/probe.mjs
A	test/lint-fixtures/check-dist/malformed-html/index.html
A	test/lint-fixtures/check-dist/noscript-comment/index.html
A	test/lint-fixtures/check-dist/noscript-style/index.html
A	test/lint-fixtures/check-dist/unknown-extension/x.weird
```

`git diff --name-status origin/main...HEAD`:

```text
M	.cursor/skills/verify-wrap-workshop/SKILL.md
M	.github/workflows/ci.yml
M	eslint.config.js
M	package-lock.json
M	package.json
A	scripts/check-dist.ts
A	scripts/comment-allowlist.d.ts
A	scripts/comment-allowlist.js
A	test/check-dist.test.ts
M	test/comment-ban.test.ts
A	test/lint-fixtures/check-dist/allow-css/main.css
A	test/lint-fixtures/check-dist/allow-html/index.html
A	test/lint-fixtures/check-dist/allow-js/main.js
A	test/lint-fixtures/check-dist/allow-miss/main.css
A	test/lint-fixtures/check-dist/broken-css/main.css
A	test/lint-fixtures/check-dist/broken-js/main.js
A	test/lint-fixtures/check-dist/css-string/main.css
A	test/lint-fixtures/check-dist/css-url/main.css
A	test/lint-fixtures/check-dist/define-vars/index.html
A	test/lint-fixtures/check-dist/event-handler-return/index.html
A	test/lint-fixtures/check-dist/event-handler-string/index.html
A	test/lint-fixtures/check-dist/event-handler/index.html
A	test/lint-fixtures/check-dist/extensions/probe.CSS
A	test/lint-fixtures/check-dist/extensions/probe.HTML
A	test/lint-fixtures/check-dist/extensions/probe.JS
A	test/lint-fixtures/check-dist/extensions/probe.cjs
A	test/lint-fixtures/check-dist/extensions/probe.mjs
A	test/lint-fixtures/check-dist/frontmatter-style/index.html
A	test/lint-fixtures/check-dist/html-comment/index.html
A	test/lint-fixtures/check-dist/inline-script/index.html
A	test/lint-fixtures/check-dist/js-string/main.js
A	test/lint-fixtures/check-dist/malformed-html/index.html
A	test/lint-fixtures/check-dist/noscript-comment/index.html
A	test/lint-fixtures/check-dist/noscript-style/index.html
A	test/lint-fixtures/check-dist/style-attr/index.html
A	test/lint-fixtures/check-dist/style-set-html/index.html
A	test/lint-fixtures/check-dist/unknown-extension/x.weird
A	test/lint-fixtures/style-attr-template.astro
A	test/lint-fixtures/style-lang-css-upper.astro
A	test/lint-fixtures/style-lang-scss-upper.astro
A	test/lint-fixtures/style-set-text.astro
```

`git diff --exit-code 7fdca61 HEAD -- src .github package.json package-lock.json` exits 0. There are no new page, workflow, package, or lockfile changes in this round. No new production hack/workaround comments, no loosened assertions, and no added `.skip` or `.only`. Comment-bearing fixture content is intentional test data.

The CI, verification-skill, and dependency changes in the full PR are the ones already reviewed in R1. Their files are unchanged this round. The allow-html wrapper change is separately shown and mutation-proven above.

## Codex attempt, cost, and final handoff

All in-scope deterministic checks passed, so made exactly one attempt from the checkout:

```text
codex -a never exec -s read-only "[short review prompt for git diff 7fdca61..HEAD]"
EXIT=1
```

The CLI reports a usage limit and says to try again at **2026-11-12 21:16 Europe/Dublin, GMT**. It also suggests an upgrade or credit purchase; neither was performed. There was no retry or alternate route.

**Token count/cost: not reported by the CLI.** Do not infer zero usage from the refusal. Codex returned no review points, so there are no unverified model opinions or cheap points to confirm. This optional failure is not BLOCKED.

- Final verdict: **PASS** at the exact reviewed head, within the stated scope.
- New evidence-backed findings: **0**.
- F1-F4 are closed. F5 remains deferred for this review, with current rejection behavior noted.
- `srcdoc` is a recorded limit, not counted against this round.
- `fail-log.tsv` is not appended because there is no new FAIL. Historical R1 entries are left intact.

Next step: hand this evidence to Eng Lead for the final merge decision, retaining the explicit deferred and record-only limits. No approval, merge, post, or further review round was started here. This completes the requested final round under the two-FAIL cap.

Full build outputs, all 79 probe results, the 19 mutation runs, fixture byte comparisons, parser-error counts, GitHub metadata, optional CLI result, and verification proof remain in `logs/r2/` beside this report. No secrets or private agent-configuration contents are included in this report.
