# PR #12 review, round 1

## Verdict at `7fdca61`: FAIL

**Five evidence-backed findings remain.** The new scanner catches every required R3/R4 reproduction, and all 68 tests pass. It still misses comments in valid noscript content, inline event handlers, skipped JavaScript/case-variant resources, and a served symlink target. It also accepts a structural HTML parse error instead of failing closed.

- [PR #12](https://github.com/kk-ai-lab/tesla-wrap-workshop/pull/12), closing [issue #11](https://github.com/kk-ai-lab/tesla-wrap-workshop/issues/11).
- Exact reviewed head: `7fdca61f0b0fe4da7666808bffe6a129c9f5be7a`.
- Base, `origin/main`, and merge-base: `b7a2fa3a17ccb4fa5a969e0cfdcb995baf16e0b1`.
- Node **v22.23.4**, npm **10.9.9**.
- Evidence collected on 2026-11-11, approximately 15:38 to 15:56 Europe/Dublin, GMT.

Fresh clone and fetch, detached checkout at the requested SHA, and a separate base worktree. No permanent code changes, commits, pushes, approvals, merges, or GitHub posts. Every temporary source/config mutation was restored, and both worktrees are clean. Final output is a pristine build, not one of the bypass artifacts.

## Acceptance read from issue #11

The issue's goal is a deterministic post-build scan of every file in `dist/`. AC1 requires a parser-based scan of `dist/**/*.html`, `*.css`, and `*.js`, including inline CSS/JS, without flagging strings or URLs. Its exact fail-closed wording is: "Anything the script can't parse fails closed."

Other requirements are the unchanged shared allowlist, CI after build, mutation-proven R3/R4 fixtures, and green main. The issue also asks for tests of the R4 set:text, template-literal, and lang-case branches. Removing lint, link data URLs, runtime-fetched content, and npm audit remain out of scope.

All original reproduction tests and requested source-lint branch guards are present and mutation-proven. The FAIL concerns the new output-scan boundaries below.

## F1: Valid noscript content is not inspected

File and line: [scripts/check-dist.ts:202-206](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/7fdca61f0b0fe4da7666808bffe6a129c9f5be7a/scripts/check-dist.ts#L202-L206).

The HTML parse uses parse5's default `scriptingEnabled: true`. In that mode, the body of `noscript` is text, so the walker never sees its HTML nodes or embedded CSS.

The following were separate files at `public/review-probe/probe.html`:

```html
<!DOCTYPE html><html><head></head><body><noscript><!-- hack --><p>fallback</p></noscript></body></html>
```

```html
<!DOCTYPE html><html><head></head><body><noscript><style>/* hack */</style></noscript></body></html>
```

For **each**, `npm run build` exits **0**, the built file is byte-identical to the source, and `npm run check:dist` exits **0** with no finding. Independent parse5 runs report no parse errors in either mode. With `scriptingEnabled: false`, the first yields the real comment node ` hack ` and the second yields the style text `/* hack */`. These are active HTML and CSS when scripting is disabled, not escaped text or JS string values.

Required change: inspect the no-scripting interpretation as well as the normal interpretation, or explicitly inspect `noscript` content in the correct HTML context. Preserve the escaped-text and script-string controls.

Guard: real-output fixtures containing both forbidden noscript cases, with expected CLI exit 1 and a named language/file finding. Removing the no-scripting inspection must fail those tests.

## F2: Inline event-handler JavaScript comments are skipped

File and line: [scripts/check-dist.ts:175-194](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/7fdca61f0b0fe4da7666808bffe6a129c9f5be7a/scripts/check-dist.ts#L175-L194).

The attribute loop checks only `style`. JavaScript in an HTML event-handler attribute never reaches Acorn.

Inserted into the real `src/site/pages/index.astro` body:

```astro
<button onclick="/* hack */ globalThis.__review=1">probe</button>
```

`npm run build` exits **0**, and `npm run check:dist` exits **0**. The built index contains this exact button. Acorn parsing of the handler body reports the comment text ` hack `.

This is inline executable JavaScript stored in its HTML handler context. It is not an arbitrary string value such as `class:list`, a CSS URL, or a JS string containing comment-looking text.

Required change: inspect inline JavaScript handler attributes in their function-body context, with the same allowlist and fail-closed behavior. A handler may legally contain `return`, so parsing the handler as an ordinary top-level module is not sufficient.

Guard: a CLI must-fail fixture for this handler and controls for a valid handler, a `return` statement, and comment-looking text inside a handler string. Disabling handler inspection must fail the negative fixture.

## F3: HTML syntax errors do not fail closed

File and line: [scripts/check-dist.ts:202-208](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/7fdca61f0b0fe4da7666808bffe6a129c9f5be7a/scripts/check-dist.ts#L202-L208).

The `try/catch` around `parseHtml(html)` does not consume parse5's recovery diagnostics. Malformed HTML can return a tree without throwing.

Built this static public asset:

```html
<!DOCTYPE html><html><head></head><body><div title="unfinished
```

The file has no closing quote or final `>`. `npm run build` exits **0**, copies it unchanged, and `npm run check:dist` exits **0**. The same parse5 call with `onParseError` reports:

```text
code: eof-in-tag
startLine: 1
startCol: 63
startOffset: 62
```

This is a demonstrated fail-closed acceptance failure, even without a comment in that file. It is not a claim that all optional end tags or browser error recovery must be forbidden.

Required change: collect and reject structural HTML parse errors rather than relying on exceptions alone. Define any intentionally accepted fragment or doctype diagnostics explicitly instead of silently accepting every recovery error.

Guard: a malformed-HTML fixture that expects CLI exit 1 and a parse-error finding. A mutation that discards HTML parser diagnostics must fail it. The current parse-error mutation kills only the broken CSS and JS tests; there is no broken HTML test.

## F4: File selection skips real JavaScript and case-variant HTML/CSS output

File and line: [scripts/check-dist.ts:53-53](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/7fdca61f0b0fe4da7666808bffe6a129c9f5be7a/scripts/check-dist.ts#L53).

The scanner accepts only the exact suffixes `.html`, `.css`, and `.js`. Dispatch at lines 242-260 uses the original case and silently skips everything else.

Each of these public assets builds unchanged, contains a real comment, and scans with exit **0**:

```text
probe.mjs   /* hack */ export const x=1;
probe.cjs   /* hack */ module.exports=1;
probe.CSS   /* hack */ .x {color:red;}
probe.HTML  <!DOCTYPE html><!-- hack --><p>probe</p>
```

A second end-to-end build also references `probe.mjs` from `<script type="module" src="/review-probe/probe.mjs">` and `probe.CSS` from a stylesheet link. It still scans with exit **0**. The review's own preview serves both with HTTP **200**, respectively `text/javascript` and `text/css`, with the forbidden comments unchanged. Acorn and PostCSS independently identify actual comment nodes/tokens.

The issue spells its minimum targets as lowercase `*.html`, `*.css`, and `*.js`. This finding addresses the current brief's broader goal that no HTML, CSS, or JS comment ships, and its explicit inclusion of public assets. These are known JavaScript and CSS resources, not arbitrary text with a comment marker. If Lead intends the exact case-sensitive globs to be an exception to that goal, Kai needs to approve and state that narrower promise.

Required change: recognize JavaScript module/common-JS suffixes and case variants of supported HTML/CSS/JS suffixes. Do not silently claim comment-free output while serving these skipped resources. Arbitrary JSON and text do not need to be treated as JavaScript.

Guard: build-and-scan fixtures for `.mjs`, `.cjs`, `.HTML`, and `.CSS`, including referenced module and stylesheet assets. Removing suffix support or case normalization must fail them.

## F5: A directory symlink hides a served .js comment

File and line: [scripts/check-dist.ts:216-225](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/7fdca61f0b0fe4da7666808bffe6a129c9f5be7a/scripts/check-dist.ts#L216-L225).

`listFiles` handles only `Dirent.isDirectory()` and `Dirent.isFile()`. A symbolic link is neither, so it disappears from the scan without a failure.

After a passing build, the requested filesystem-boundary probe created `dist/review-link` as a directory symlink to an owned temporary directory outside `dist`. That target contains:

```js
/* hack */ const x=1;
```

Reading `dist/review-link/comment.js` returns those bytes. `npm run check:dist` exits **0**. The review's own preview then serves `GET /review-link/comment.js` with **200**, `Content-Type: text/javascript`, and the comment unchanged. Acorn identifies its real JS comment.

The symlink was a deliberate post-build artifact mutation, not a claim that the pristine Astro build creates a link. It demonstrates that a directory present in the scanned output can contain a served, uninspected `.js` file.

Required change: reject symlinks explicitly and fail closed, or implement a bounded, cycle-safe, root-constrained traversal policy. Do not silently omit them. Rejecting them is sufficient and avoids following unknown external targets.

Guard: an isolated temporary-root test containing a directory symlink to a JS comment file. The CLI must exit 1. Ignoring symbolic links again must fail the test.

## Base and head checks pass

The following commands ran in the base worktree and on the head. The head chain was rerun after all mutations were restored.

| Command | Base b7a2fa3 | Head, initial | Head, restored | Key result |
|---|---:|---:|---:|---|
| `node -v` | 0 | 0 | 0 | v22.23.4 |
| `npm ci` | 0 | 0 | 0 | Clean installs succeed |
| `npm run lint` | 0 | 0 | 0 | `eslint .` |
| `npm run typecheck` | 0 | 0 | 0 | `tsc --noEmit` |
| `npm test` | 0 | 0 | 0 | Base 48 passed; head 68 passed |
| `npm run check` | 0 | 0 | 0 | `check: 1 wrap, 0 violations` |
| `npm run build` | 0 | 0 | 0 | Static output; `Complete!` |
| `npm run check:dist` | Not yet a base script | 0 | 0 | Scanner stdout empty |

Also ran the head scanner against the built base output:

```text
$ npm run check:dist -- ../base/dist
EXIT=0
```

The head has 20 more tests than base: 16 dist-scan tests and 4 source-lint branch tests. Running the same negative fixture twice produces byte-identical scanner output and exit 1 both times. Paths are sorted before scanning.

## Required R3/R4 cases are caught after successful real builds

Each insertion used the real `src/site/pages/index.astro`, not only hand-written unit fixtures. Each builds successfully before the scan fails, and each is restored afterward. Existing lint is deliberately not used to stop these output-guard probes.

| Reproduction | Build exit | check:dist exit | Actual scanner message | First comment location in built output |
|---|---:|---:|---|---|
| r4-define-vars | 0 | 1 | `css comment in index.html` | `index.html:1:44` |
| r4-frontmatter-style | 0 | 1 | `css comment in index.html` | `index.html:1:119` |
| r3-set-html | 0 | 1 | `css comment in index.html` | `index.html:1:114` |
| r3-style-attribute | 0 | 1 | `css comment in index.html` | `index.html:1:119` |
| inline-script | 0 | 1 | `js comment in index.html` | `index.html:1:115` |

The define:vars case produces five CSS findings because Astro copies the custom property to several inline attributes. The other cases produce one finding each. The cases were:

```astro
<style define:vars={{a:"/* hack */"}}>.x { color:var(--a); }</style>
<div style={x}>probe</div>
<style set:html={"/* hack */"}></style>
<div style="/* hack */ color:red">probe</div>
<script is:inline>/* hack */ globalThis.__review = 1;</script>
```

For the second case, the page frontmatter contains `const x = "/* hack */ color:red";`. The locations in the table were independently measured in the built files. The scanner currently reports only language and filename, not line/column. That is a diagnostic gap against the requested done-evidence format, but not an additional blocking issue-AC finding.

## All requested mutations fail tests

Each mutation ran the full `npm test -- --reporter=verbose` suite, then restored the changed file and confirmed a clean tree.

| Mutation | Test exit | Failed / passed | What it proves |
|---|---:|---:|---|
| scanRoot-off | 1 | 9 / 59 | Kills every required must-fail output reproduction, plus HTML/allowlist and CSS/JS parse-error cases |
| HTML-off | 1 | 6 / 62 | HTML and all embedded-language fixtures depend on the HTML walk |
| CSS-off | 1 | 6 / 62 | CSS comments and CSS parse failures are not superficial assertions |
| JS-off | 1 | 2 / 66 | Inline JS and invalid JS are guarded |
| style-attribute-off | 1 | 3 / 65 | define:vars, local-literal style, and direct style-attribute fixtures are sensitive |
| parse-errors-pass | 1 | 2 / 66 | Both broken CSS and broken JS fail |
| CI-step-removed | 1 | 1 / 67 | The CI wiring test fails |
| CI-order-reversed | 1 | 1 / 67 | The ordering assertion fails, not only step-presence detection |
| lint-set-text-branch-removed | 1 | 1 / 67 | New set:text test kills the former surviving branch mutation |
| lint-template-branch-removed | 1 | 1 / 67 | New template-literal test kills the former surviving branch mutation |
| lint-lang-case-weakened | 1 | 1 / 67 | New uppercase CSS test kills the former case-normalization survivor |

Build's claimed **9 failures for scanRoot returning []** and **1 failure for removing the CI step** are correct. Under the scanRoot mutation, all five required must-fail reproduction tests fail by name. Restoring the scanner returns the suite to 68 passing tests.

The parse-error mutation changes the CSS/HTML error returns and the JS parse-failure return to an empty array. Only the CSS and JS tests fail. F3 explains why HTML error recovery remains unguarded.

The CI test at `test/check-dist.test.ts:98-104` reads the real workflow and asserts:

```ts
expect(buildAt).toBeGreaterThan(-1);
expect(checkAt).toBeGreaterThan(buildAt);
expect(ci.match(/npm run check:dist/g)).toHaveLength(1);
```

This is a text-order test, not a YAML job interpreter. Both deletion and order reversal were killed. The actual workflow was also validated and its successful executed steps independently checked through GitHub.

## Parser and false-positive checks

The implementation uses parse5 7.3.0 for HTML, `postcss.parse` plus the PostCSS tokenizer for CSS, and Acorn 8.19.0 for JS. It does not classify comments with a bare regex. The shared regexes apply only after a parser/tokenizer finds a comment body.

Every following control was emitted through public assets, built unchanged, and scanned with exit **0**:

- JS string `const x = "/* not a comment */";`.
- JS template literal containing `/* not a comment */`.
- JS regex literal `const x = /[/*]/;`.
- CSS quoted string containing `/* not a comment */`.
- CSS `url(https://example.test/a/*/b)`.
- CSS `content:"/*"`.
- HTML text `&lt;!-- hack --&gt;`.
- Bare issue URL, bare RFC URL, and single-line SPDX comments in each of HTML, CSS, and JS.
- A JS string containing `<!-- not a comment -->` inside an HTML script.

A URL or a string is not fetched or evaluated during these checks. The allowed comment controls contain exactly the existing policy forms.

## Full built-output boundary matrix

These are 48 separate build-and-scan probes. The source cases use the real page. Asset cases use `public/review-probe/probe<extension>` and are verified byte-identical in `dist`. The symlink is deliberately added to a completed build. All build exits are 0. Findings F1-F5 include the two additional real-page builds for a handler and explicitly referenced resources.

| Probe | Input or context | Build | Scan | Observed result |
|---|---|---:|---:|---|
| r4-define-vars | `<style define:vars={{a:"/* hack */"}}>.x { color:var(--a); }</style>` | 0 | 1 | css comment in index.html |
| r4-frontmatter-style | `const x = "/* hack */ color:red";\n<div style={x}>probe</div>` | 0 | 1 | css comment in index.html |
| r3-set-html | `<style set:html={"/* hack */"}></style>` | 0 | 1 | css comment in index.html |
| r3-style-attribute | `<div style="/* hack */ color:red">probe</div>` | 0 | 1 | css comment in index.html |
| inline-script | `<script is:inline>/* hack */ globalThis.__review = 1;</script>` | 0 | 1 | js comment in index.html |
| js-string | `const x = "/* not a comment */";` | 0 | 0 | Pass; no finding |
| js-template | `` const x = `/* not a comment */`; `` | 0 | 0 | Pass; no finding |
| js-regex | `const x = /[/*]/;` | 0 | 0 | Pass; no finding |
| css-string | `.x {font-family:"/* not a comment */";}` | 0 | 0 | Pass; no finding |
| css-url | `.x {background:url(https://example.test/a/*/b);}` | 0 | 0 | Pass; no finding |
| css-content | `.x::before {content:"/*";}` | 0 | 0 | Pass; no finding |
| html-text-escaped | `<!DOCTYPE html><p>&lt;!-- hack --&gt;</p>` | 0 | 0 | Pass; no finding |
| allowed-html | `<!DOCTYPE html><!-- https://github.com/a/b/issues/1 --><!-- https://www.rfc-editor.org/rfc/rfc9110 --><!-- SPDX-License-Identifier: MIT -->` | 0 | 0 | Pass; no finding |
| allowed-css | `/* https://github.com/a/b/issues/1 */\n/* https://www.rfc-editor.org/rfc/rfc9110 */\n/* SPDX-License-Identifier: MIT */` | 0 | 0 | Pass; no finding |
| allowed-js | `// https://github.com/a/b/issues/1\n// https://www.rfc-editor.org/rfc/rfc9110\n// SPDX-License-Identifier: MIT` | 0 | 0 | Pass; no finding |
| extension-mjs | `/* hack */ export const x=1;` | 0 | 0 | Real JS comment skipped; F4 |
| extension-cjs | `/* hack */ module.exports=1;` | 0 | 0 | Real JS comment skipped; F4 |
| extension-map | `{"version":3,"sourcesContent":["/* string data */"]}` | 0 | 0 | Valid JSON source-map data, not JS source comments |
| extension-svg | `<svg xmlns="http://www.w3.org/2000/svg"><!-- hack --><style>/* hack */</style></svg>` | 0 | 0 | Standalone SVG is skipped, including its CSS body; unsupported container noted below |
| extension-xml | `<?xml version="1.0"?><root><!-- hack --></root>` | 0 | 0 | Standalone XML is not scanned; XML-only comments are outside named HTML/CSS/JS file parsers |
| extension-json | `{"text":"/* string data */"}` | 0 | 0 | Valid JSON string data, not a JS comment |
| extension-txt | `/* arbitrary text */` | 0 | 0 | Arbitrary text, no inferred code language |
| extension-odd | `/* text of unspecified type */` | 0 | 0 | Unknown format, not classified as code |
| extension-none | `/* text of unspecified type */` | 0 | 0 | Unknown format, not classified as code |
| extension-HTML | `<!DOCTYPE html><!-- hack --><p>probe</p>` | 0 | 0 | Real HTML comment skipped; F4 |
| extension-CSS | `/* hack */ .x {color:red;}` | 0 | 0 | Real CSS comment skipped; F4 |
| inline-svg-style | `<!DOCTYPE html><svg><style>/* hack */</style></svg>` | 0 | 1 | css comment in review-probe/probe.html |
| inline-svg-comment | `<!DOCTYPE html><svg><!-- hack --></svg>` | 0 | 1 | html comment in review-probe/probe.html |
| noscript-comment | `<!DOCTYPE html><html><head></head><body><noscript><!-- hack --><p>fallback</p></noscript></body></html>` | 0 | 0 | Missed valid HTML comment; F1 |
| noscript-style | `<!DOCTYPE html><html><head></head><body><noscript><style>/* hack */</style></noscript></body></html>` | 0 | 0 | Missed embedded CSS comment; F1 |
| template-comment | `<!DOCTYPE html><template><!-- hack --></template>` | 0 | 1 | html comment in review-probe/probe.html |
| module-script | `<!DOCTYPE html><script type="module">/* hack */ export const x=1;</script>` | 0 | 1 | js comment in review-probe/probe.html |
| script-json-valid | `<!DOCTYPE html><script type="application/json">{"value":"/* string data */"}</script>` | 0 | 0 | Known non-JS data block skipped; string control passes |
| script-json-invalid-comment | `<!DOCTYPE html><script type="application/json">{/* hack */ "value":1}</script>` | 0 | 0 | Known non-JS data block skipped; invalid JSON is not validated |
| script-ldjson-invalid-comment | `<!DOCTYPE html><script type="application/ld+json">{/* hack */ "value":1}</script>` | 0 | 0 | Known non-JS data block skipped; invalid JSON is not validated |
| script-text-template | `<!DOCTYPE html><script type="text/template"><!-- hack --></script>` | 0 | 1 | parse error in review-probe/probe.html: unsupported script type |
| conditional-ie | `<!DOCTYPE html><!--[if IE]><p>legacy</p><![endif]-->` | 0 | 1 | html comment in review-probe/probe.html |
| script-html-looking-string | `<!DOCTYPE html><script>const x = "<!-- not a comment -->";</script>` | 0 | 0 | Pass; no finding |
| preserved-css | `/*! hack */.x{color:red}` | 0 | 1 | css comment in review-probe/probe.css |
| import-css | `@import /* hack */ "x.css";` | 0 | 1 | css comment in review-probe/probe.css |
| fontface-css | `@font-face{font-family:x;/* hack */src:url(x.woff2)}` | 0 | 1 | css comment in review-probe/probe.css |
| js-hashbang | `#!/usr/bin/env node\nconst x=1;` | 0 | 1 | js comment in review-probe/probe.js |
| js-html-comment | `<!-- hack\nconst x=1;` | 0 | 1 | js comment in review-probe/probe.js |
| js-jsx | `const x=<div/>;` | 0 | 1 | parse error in review-probe/probe.js: Unexpected token (1:8) |
| html-eof-tag | `<!DOCTYPE html><html><head></head><body><div title="unfinished` | 0 | 0 | Parser-reported eof-in-tag accepted; F3 |
| html-invalid-comment | `<!DOCTYPE html><!-- hack` | 0 | 1 | html comment in review-probe/probe.html |
| huge-js | `(8 MiB spaces) /* hack */` | 0 | 1 | Final real JS comment caught in 8,388,618-byte file |
| symlink-directory | `directory symlink to owned comment.js` | 0 | 0 | Readable and served JS comment skipped; F5 |

### Classification of the other boundaries

- Inline SVG style and comment nodes are caught. Template content is caught through its `content.childNodes` traversal.
- Module script comments are caught. Known JSON and JSON-LD script types are skipped as non-JS data blocks. Even malformed JSON is not validated; `JSON.parse` independently rejects the tested comment-bearing JSON payloads. No extra JS-comment finding is claimed for a non-JS data block.
- `type="text/template"` is unsupported and fails closed with `parse error ... unsupported script type`.
- IE conditional comments, preserved `/*!` CSS comments, comments in `@import` and `@font-face`, hashbangs, and JS HTML-like comments are caught.
- JSX-like content in a `.js` asset fails closed with `Unexpected token (1:8)`.
- The 8 MiB JS probe is scanned to its final real comment and exits 1. No general size or performance guarantee is inferred from one probe.
- `.map` and `.json` controls contain comment-looking string data, not real comments in those formats. `.txt` and unknown suffixes do not establish a code language. They are not false-negative JS findings.
- Standalone SVG/XML are skipped. The SVG probe includes real embedded CSS in addition to its XML comment. That unsupported container is recorded, not counted as another finding beyond F4's proven known-JS and case-variant-resource selection defect. The issue's named standalone parsers do not promise an XML parser.

The referenced `.mjs` and uppercase `.CSS` assets, and the symlinked `.js` file, were also served by a preview started only for this review. Each returned HTTP 200 with the relevant JS/CSS content type and the real comment bytes. The preview was stopped and its port was confirmed closed before the clean verification run.

## One unchanged allowlist is shared

Compared every `String.raw` regex source with base main's `eslint.config.js`. The ordered arrays are byte-identical. The trim-before-match behavior also stays the same.

```js
export const allowedCommentSources = [
  String.raw`^https://github\.com/[\w.-]+/[\w.-]+/(?:issues|pull)/\d+$`,
  String.raw`^https://www\.rfc-editor\.org/rfc/rfc\d+$`,
  String.raw`^https://datatracker\.ietf\.org/doc/html/rfc\d+$`,
  String.raw`^SPDX-License-Identifier:[ \t]+[A-Za-z0-9][A-Za-z0-9.\-+]*$`,
];

const allowedCommentPatterns = allowedCommentSources.map((source) => new RegExp(source));

export function allowsComment(text) {
  const trimmed = text.trim();
  return allowedCommentPatterns.some((pattern) => pattern.test(trimmed));
}
```

`eslint.config.js` imports both `allowedCommentSources` and `allowsComment` from `scripts/comment-allowlist.js`. `scripts/check-dist.ts` imports `allowsComment` from that same file. There is no second regex-policy definition. `scripts/comment-allowlist.d.ts` supplies types, not another runtime policy. The pre-existing GitHub pull-URL form is preserved along with issue URLs; no exception is widened.

The allowlisted HTML, CSS, and JS fixtures pass. The extra-prose URL fixture fails, and turning the scan off kills that negative test too.

## CI and PR metadata verified through the connector

```text
PR #12:
  head.sha: 7fdca61f0b0fe4da7666808bffe6a129c9f5be7a
  draft: true
  mergeable: true
  mergeable_state: clean
  changed_files: 29
```

[CI run 43049666095](https://github.com/kk-ai-lab/tesla-wrap-workshop/actions/runs/43049666095) reports the exact head SHA, `event: pull_request`, `status: completed`, and `conclusion: success`. The [check job](https://github.com/kk-ai-lab/tesla-wrap-workshop/actions/runs/43049666095/job/130622998395) reports every step successful, including this order:

```text
npm ci
npm run lint
npm run typecheck
npm test
npm run check
npm run build
npm run check:dist
```

The workflow still uses Node 22, PR and main-push triggers, and `permissions: contents: read`. Its only delta is the new step after build. No deploy step or secret reference is added. `action-validator` and `actionlint` both exit **0** on the restored workflow.

## The updated verification skill passes end to end

The skill now runs `check:dist` after build, documents the expected empty scanner stdout, and retains `check-dist.txt` as a third proof file. Those changes match the new user path.

Ran the skill with the final pristine build. A newly started direct Node 22 preview had its PID, checkout, and socket verified before the doctor and driver ran:

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

The download matches the built PNG bytes. Stopped only this review's preview, verified its process was gone and curl exited 7, removed its PID file, and retained all three proof files.

Normal project lint enumerates **20 files, zero fixture files, and zero errors**. The final `rg --files dist` result contains only:

```text
dist/index.html
dist/wraps/sample-solid-grey/Solid Grey.png
```

None of the new fixtures or probes ships in the pristine build.

## Scope and dependencies

`git diff --name-status origin/main...HEAD` reports exactly 29 files:

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
A	test/lint-fixtures/check-dist/frontmatter-style/index.html
A	test/lint-fixtures/check-dist/html-comment/index.html
A	test/lint-fixtures/check-dist/inline-script/index.html
A	test/lint-fixtures/check-dist/js-string/main.js
A	test/lint-fixtures/check-dist/style-attr/index.html
A	test/lint-fixtures/check-dist/style-set-html/index.html
A	test/lint-fixtures/style-attr-template.astro
A	test/lint-fixtures/style-lang-css-upper.astro
A	test/lint-fixtures/style-lang-scss-upper.astro
A	test/lint-fixtures/style-set-text.astro
```

`git diff --exit-code b7a2fa3 HEAD -- src docs` exits 0. Source, the sample wrap, and the page are unchanged by the PR. The shared module, scanner, workflow step, skill update, types, and tests all relate to the issue. No assertions are loosened, and no `.skip` or `.only` is added. Added code comments occur only in intentional scanner/lint fixture data, not as new production hacks or workarounds.

Dependency audit of the lockfile delta:

- `acorn` is now declared directly at **8.19.0**. That exact package entry already existed; its version and integrity do not change.
- `parse5` is declared at **7.3.0**. Its only new transitive package entry is nested `entities` **6.0.1**.
- Both new package entries resolve from `registry.npmjs.org` and have SHA-512 integrity hashes.
- No existing package entry changes and no package is removed. Only root dependency metadata plus the two new entries change.
- PostCSS stays declared at **8.5.32**. No upgrade or audit finding is included.

## New guards and the problems they catch

| New guard | Mutation proof | R3-F1 / R4-F1 coverage |
|---|---|---|
| HTML tree walk plus CSS scans of style blocks and attributes | HTML off: 6 failures; attribute off: 3 | Catches R3 set:html and style attributes, and both R4 literal routes in real builds |
| CSS parser plus tokenizer, including custom-property comments | CSS off: 6; parse-errors-pass kills broken CSS | Catches define:vars custom-property comments that PostCSS child-comment traversal alone missed |
| Acorn comments in inline and emitted `.js` | JS off: 2; parse-errors-pass kills broken JS | Adds the required inline-script guard; not a CSS source-language fix |
| Root scan/CLI exit behavior | Returning [] kills 9 tests | Every required reproduction fixture becomes a failing test |
| Shared allowlist extraction | Exact source comparison; allowed controls pass and extra-prose fixture fails | Prevents lint/scanner policy drift without weakening the original policy |
| CI after build | Deletion and reverse-order mutations each kill 1 | Makes the new output guard an executed CI step; green run independently confirms it |
| set:text, template-literal, and strict lang-case source tests | Each former weakening now kills 1 | Closes the three R4 non-blocking guard-test gaps |

R3's unsupported SCSS source case remains protected by the unchanged lint rule. A failed or unbuilt SCSS source is not dist output. If supported SCSS builds into CSS, the output CSS goes through the scanner.

The original R4-F1 and R3 plain-CSS reproductions are closed by these new guards. The findings in this report are new output-boundary and HTML fail-closed gaps, not surviving removal of the implemented whole scan or its per-type scanners.

## Codex, findings count, and next step

Codex was **not run** because deterministic acceptance probes fail. The user permits it only after every deterministic check passes. **Token cost: 0; no attempt.** No unverified model opinions contribute to this verdict.

There are **5 evidence-backed findings**, F1-F5, each with a file/line, reproduction, required change, and proposed regression guard above. They are appended to `fail-log.tsv`. The missing comment line/column diagnostic is a non-blocking note, not a sixth finding.

Next step: return the evidence to Eng Lead. Close the HTML interpretation, inline-JS, parse-error, file-selection, and symlink boundaries, or obtain Kai's explicit approval for any narrower output guarantee. Keep the proven R3/R4 fixtures and the new source-branch tests. No fix or further review round was started here.

Full command output, built HTML snapshots, parser-confirmation results, HTTP responses, mutation failures, scope checks, and verification output remain in `logs/` beside this report. The report contains the evidence needed to read the verdict on GitHub.
