# Review round 1: kk-ai-lab/tesla-wrap-workshop PR #2

- PR: https://github.com/kk-ai-lab/tesla-wrap-workshop/pull/2 (Draft), "feat(check): validate one sample wrap"
- Issue: #1 (I1). Design: /workspace/eng-team/design/tesla-wrap-workshop/DESIGN.md §2.2, §3
- Head reviewed: e4d379c50d5d89f7c5faa3403efea62d0ebedfe9 (`git rev-parse HEAD` matches, PR API head.sha matches). Base: origin/main 8420603 ("Initial commit", README only)
- Checkout: /workspace/eng-team/review/tesla-wrap-workshop-pr2/repo (detached at head); base worktree: ../base
- Node: v22.23.4 (official tarball, sha256 verified, at ~/.local/node22), npm 10.9.9. Box default node is v24, not used.
- Run time: 2026-11-09 09:58–10:01 GMT (Europe/Dublin). Raw logs: ./logs/

## Verdict: FAIL (1 blocking finding)

All deterministic checks pass, and every guard fails when it should. One acceptance-level test gap: removing the PNG magic-byte check from `checkPng` does not fail any test (mutant survives). Codex was not run because step 3 (prove the tests are real) did not fully pass. See "Codex" below.

## F1 (blocking): the magic-byte check is untested; the "JPEG renamed to .png" fixture never reaches it

- Files: `test/check-png.test.ts:28-32`, `scripts/generate-pngs.mjs:63` (fixture source), code under test `src/domain/spec.ts:47`.
- Cause: `renamed-jpeg.png` is a 22-byte stub (`ff d8 ff e0 00 10 4a 46 49 46 00 01 01 00 00 01 00 01 00 00 ff d9`). `checkPng` returns `not-png` from the `bytes.byteLength < 24` short-circuit, so the magic comparison is never the reason for the rejection.
- Evidence (logs/mutations.txt):
  - Mutant: delete `!matches(bytes, 0, SPEC.pngMagic) ||` at spec.ts:47 → `npx vitest run test/check-png.test.ts` → `Tests 6 passed (6)` (survives).
  - With that mutant, a PNG whose byte 1 is changed to 0x51 (IHDR intact) placed as the sample → `npm run check` prints `check: 1 wrap, 0 violations`, exit 0. On the real code the same file gives `not-png sample-solid-grey`, exit 1. So the code is right today, but nothing stops a regression on the one criterion Eng Lead singled out ("check the magic bytes, not just the extension").
- Required change: make the JPEG fixture a real JPEG of at least 24 bytes (so the length guard can't be what rejects it), and add a `bad-signature.png` fixture: valid PNG bytes with a corrupted signature byte and IHDR intact, expected `[{ code: "not-png" }]`. Add a size precondition the same way the too-big test does at line 16: `expect(bytes.byteLength).toBeGreaterThanOrEqual(24)`.
- Guard that bans this class: the test itself, plus that precondition assertion. Acceptance for the fix: re-running the mutant above must fail at least one test in check-png.test.ts.

## Other mutants (all killed, reverted; tree clean after each)

| Mutant in spec.ts | Result |
|---|---|
| size check → `false` | killed: "rejects too-big.png at 1000001 bytes" |
| size `>` → off-by-two | killed: same test |
| filename `{1,26}` → `{1,27}` | killed: "rejects abcdefghijklmnopqrstuvwxyz1.png" |
| dims check → `false` | killed: 1023x1024 and cybertruck tests |
| width-only comparison (Cybertruck treated as square) | killed: "rejects a 1024x1024 png for cybertruck" |
| remove magic check | **SURVIVED** (F1) |

`.skip/.only/.todo/xit`/empty expects: none in test/. Assertions use exact `toEqual` on violation arrays. Build's PR body also shows a red run before the source existed (missing modules plus two CLI assertion failures), then green.

## Step 1: deterministic checks

PR head, `npm ci && npm test && npm run check && npm run build` → exit 0 (logs/head-main-chain.txt):
```
added 249 packages, and audited 250 packages in 4s
4 vulnerabilities (1 moderate, 1 high, 2 critical)
 ✓ test/check-png.test.ts (6 tests)
 ✓ test/load.test.ts (12 tests)
 ✓ test/check-cli.test.ts (2 tests)
 Tests  20 passed (20)
check: 1 wrap, 0 violations
[build] 1 page(s) built in 350ms
[build] Complete!
```
- `npx tsc --noEmit -p .` → exit 0, no output (strict mode; covers src, test, vitest.config.ts; not astro.config.mjs or .astro files).
- No lint or typecheck npm scripts exist. `astro check` is not configured (`@astrojs/check` is not a dependency), so it was not run, to avoid adding a dependency.
- Built HTML (`dist/index.html`): `<li>Solid Grey <a href="/wraps/sample-solid-grey/Solid%20Grey.png" download="Solid Grey.png">Solid Grey.png</a></li>`. `dist/` = index.html (245 B) plus `wraps/sample-solid-grey/Solid Grey.png` (3154 B, byte-identical to content). No `<script>`, no JS shipped.

Base main (logs/base-main-chain.txt): the tree is README.md only. `npm ci` → `EUSAGE ... can only install with an existing package-lock.json`, exit 1. Nothing to test, check or build on base. "Before" behaviour is therefore "no checker exists". Test realness was proven with mutants instead.

## Step 2: guard-by-guard negative results (logs/negatives.txt; `git checkout content` + clean after each; final `git status` empty)

Done-evidence command, verbatim:
```
$ cp test/fixtures/too-big.png content/wraps/sample-solid-grey/"Solid Grey.png" && npm run check; echo $?
too-big 1000001 bytes sample-solid-grey
1
$ git checkout content  → Updated 1 path from the index
```
| Guard | Break | Output | Exit |
|---|---|---|---|
| G1 | 1023x1024 as model3 | `wrong-dims 1023x1024 want 1024x1024 sample-solid-grey` | 1 |
| G1 | JPEG bytes named .png | `not-png sample-solid-grey` | 1 |
| G1 | variant=cybertruck, 1024x1024 sample | `wrong-dims 1024x1024 want 1024x768 sample-solid-grey` | 1 |
| G1 | 27-char stem (31 chars) | `bad-name abcdefghijklmnopqrstuvwxyz1.png sample-solid-grey` | 1 |
| G1 | truncated 20-byte file | `not-png sample-solid-grey` | 1 |
| G1 boundary | 26-char stem (30 chars) | `check: 1 wrap, 0 violations` (correct pass) | 0 |
| G1 boundary | exactly 1,000,000 bytes | `check: 1 wrap, 0 violations` (correct pass) | 0 |
| G2 | variant "roadster" | `schema variant Invalid enum value. Expected 'cybertruck' \| ... received 'roadster'` | 1 |
| G2 | title removed | `schema title Required` | 1 |
| G2 | stored `width` key | `schema  Unrecognized key(s) in object: 'width'` | 1 |
| G2 | id ≠ folder | `id-mismatch sample-solid-grey other-id sample-solid-grey` | 1 |
| G2 | invalid JSON | `schema meta.json invalid JSON` | 1 |
| G2 | meta.json deleted | `schema meta.json missing meta.json` | 1 |
| G2 | file → Missing.png | `schema file missing file` | 1 |
| G3 | licence MIT | `schema licence Invalid enum value. Expected 'CC-BY-4.0' \| 'CC0-1.0', received 'MIT'` | 1 |
| G3 | licence PD | same, received 'PD' | 1 |
| G3 | provenance [] | `schema provenance Array must contain at least 1 element(s)` | 1 |
| G3 | provenance removed | `schema provenance Required` | 1 |
| G3 | third-party with author only | `licence-provenance CC0-1.0 third-party` | 1 |
| G3 | CC-BY-4.0 + complete third-party | `licence-provenance CC-BY-4.0 third-party` | 1 |
| G4 | copy of the sample as second wrap `sample-solid-grey-copy` | `dup-sha 8f0a39…7e73 sample-solid-grey,sample-solid-grey-copy` reported for both wraps | 1 |

Extra edge probes (my own, deterministic): unicode `Grëy.png`, `Grey.PNG`, `../Grey.png`, `a/b.png`, trailing newline, `.png` → all `bad-name`. Empty and 23-byte inputs → `not-png`. A Uint8Array view at a non-zero byteOffset → correct (DataView honours byteOffset). `file: "../../../package.json"` → `bad-name` + `not-png`, exit 1. A directory named `Solid Grey.png` → `schema file missing file`. A stray file at the content root is ignored.

## Step 4: verification skill (.cursor/skills/verify-wrap-workshop/; logs/skill-run.txt)

The SKILL.md was followed as written: `npm ci`, `npm run build`, then `node ./node_modules/astro/bin/astro.mjs preview --host 127.0.0.1 --port 4173` started directly. The pid was written to /tmp/wrap-workshop-verify/preview.pid.
```
$ curl -sI http://127.0.0.1:4173/ | head -n 1   → HTTP/1.1 200 OK
$ test -f /tmp/wrap-workshop-verify/preview.pid → exit=0 pid=127398 (ss: listener on 4173 is node pid 127398)
$ node -v → v22.23.4
$ node scripts/verify-site.mjs http://127.0.0.1:4173
listed sample-solid-grey
link /wraps/sample-solid-grey/Solid%20Grey.png
file dist/wraps/sample-solid-grey/Solid Grey.png 3154 bytes
GET http://127.0.0.1:4173/wraps/sample-solid-grey/Solid%20Grey.png 200 image/png 3154 bytes
verify-site exit=0
$ npm run check → check: 1 wrap, 0 violations, exit=0
Cleanup: killed pid 127398; curl to :4173 → refused (exit 7); pid file removed; proof files kept.
```
Note: the helper lives at repo `scripts/verify-site.mjs`, not under the skill's own `scripts/`. SKILL.md says so, so this is fine. This PR creates the skill, so it can't be stale. The negative path (too-big → exit 1) is only a gotcha in check-cli.md, not a driven sub-feature. Consider adding it (not a FAIL).

## Step 5: diff audit and file-count reconciliation

`git diff --name-status origin/main...HEAD` → **32** files (31 A, 1 M = README.md), 6,779 insertions. This matches GitHub's `changed_files: 32`.
By commit: 9b9f309 scaffold (9), 67f6bb7 feat (20, of which astro.config.mjs and index.astro were already in the scaffold commit), c816edd skill (5), e4d379c skill edits (2, already counted). Unique total 32.
Build's "30" can't be reproduced from git. The most likely explanation is that it left out the generated `package-lock.json` and the modified (not added) `README.md`. Every one of the 32 files is accounted for:
- config: .gitignore, .nvmrc (22), package.json, package-lock.json, astro.config.mjs, tsconfig.json, vitest.config.ts, README.md
- src: domain/{variants,licences,wrap,spec}.ts, catalogue/load.ts, cli/check.ts, site/pages/index.astro
- content: sample-solid-grey/{meta.json, Solid Grey.png}
- tests: 3 test files + 6 fixtures
- scripts: generate-pngs.mjs, verify-site.mjs; skill: 4 .md files
- Binaries: exactly the 6 fixtures + 1 sample. No fonts, SVG, JPEG files, `template.png`, `vehicle_image.png`, or anything Tesla-named.
- Sample PNG: 3154 B, signature OK, IHDR 1024x1024, 8-bit greyscale, chunks IHDR/IDAT/IEND only. The decoded scanlines contain only filter byte 0 and pixel value 128, so it is uniform grey. `node scripts/generate-pngs.mjs` regenerates it (and all fixtures) byte-for-byte (tree stays clean), so it is our own generated grey and not a Tesla template. sha256 8f0a395a…7e73 (same bytes as valid.png and cybertruck-square.png; fixtures sit outside content/, so G4 is not affected).
- Lockfile: v3, 381 entries, all resolved from registry.npmjs.org, all with integrity. Install scripts are only esbuild and fsevents (normal).
- The only Tesla reference is `templateUrl()` linking to github.com/teslamotors/custom-wraps (link, not rehost; matches design).

## Step 6: new comments

No code comments were added in the diff (lockfile and .md excluded). The only grep hits were URLs inside strings and a `test/**/*.test.ts` glob. Nothing to flag.

## Step 7: Build's open questions

**Q1: own provenance with no author.**
- DESIGN.md §2.2 (line 112): `| { kind: "own"; author: string; createdWith?: string }  // our design`. The third-party variant also has `author: string`.
- DESIGN.md §3 G3 (line 183) fails only when: "licence not in `LICENCES`; provenance kind not allowed; third-party entry missing url/licence/date". It does not require an own author.
- Code `src/domain/wrap.ts:21-27`: `kind: z.literal("own"), author: z.string().optional(), createdWith: z.string().optional()`. The sample meta.json has `"provenance": [{ "kind": "own" }]`. The PR body discloses this: "Own provenance may be kind alone. The design required an author, and the sample in the issue does not."
- Judgement: this departs from the §2.2 type but not from the issue's acceptance criteria ("own provenance") or the §3 G3 fail conditions. **Not a FAIL.** Recommendation: follow the design, because an unattributed "own" claim weakens the I11 legal packet and the fix costs about two lines. That means `author: z.string().trim().min(1)` and `"author": "<Kai or project name>"` in the sample. Otherwise amend §2.2. Eng Lead's or Kai's call. Related: third-party `author/sourceUrl/...` are `.optional()` in the zod type and only enforced at runtime by `thirdPartyComplete()` (wrap.ts:77-90). The behaviour is tested and correct, but the inferred `WrapMeta` type no longer matches §2.2's required fields. Folding the check into the schema (`z.string().trim().min(1)`, `retrievedOn: z.string().regex(DATE)`) would make the type the guard.

**Q2: the 4 npm audit advisories (`npm audit --json`, logs/npm-audit.json).** Build's description "in the Astro tree" is inaccurate: none are in Astro.
| Package | Sev | Advisory | Path | Ships? |
|---|---|---|---|---|
| vitest 3.2.7 (direct, dev) | critical (rolls up the two below) | GHSA-82fw-gwwq-j7x9 path traversal via @vitest/mocker | devDependency | No: test runner only |
| tinypool 1.1.1 (via vitest) | critical | GHSA-5gmw-xhrv-c9v3, GHSA-85c8-ppgw-ccpr prototype-pollution → RCE gadget in worker options | dev | No |
| @vitest/mocker (via vitest) | moderate | GHSA-82fw-gwwq-j7x9, GHSA-qxg6-89mg-rqv8 (mock registration code injection, affects the browser/API server mode) | dev | No |
| zod 3.25.76 (direct dep) | high | GHSA-mrhx-c7xc-m3w5 memory exhaustion validating oversized constrained collections (<4.6.6) | used by wrap.ts at check/build time only | No: dist has no JS; inputs are committed, PR-reviewed meta.json |
(Astro's own nested zod is 4.6.7, already patched.) None of them affects the static output: `dist/` is one HTML file plus the PNG, with no `<script>`. Risk is limited to the developer/CI machine running tests on untrusted input, which v1 doesn't do. **Not a FAIL.** A follow-up issue is warranted as a chore after I2 (CI): vitest 3 → 5 and zod 3 → 4 (both semver-major; zod 4 changes the `.strict()`/enum APIs used in wrap.ts), with `npm audit --omit=dev` added to CI so runtime advisories block and dev ones warn.

## New guards the PR adds (each checked against the problem it targets)
- G1 `checkPng` (spec.ts): magic + IHDR, ≤1,000,000 B, name regex, exact template dims. Each condition fails on a negative above. The magic part has no test (F1).
- G2 zod `.strict()` schema + id==folder + file present (wrap.ts, load.ts): all 7 breaks fail; `.strict()` also enforces design §2.2's "derived, not stored" rule (stored width rejected).
- G3 licence enum built from `LICENCES` + per-licence `allows` + third-party completeness: MIT, PD, empty/missing provenance, incomplete third-party, CC-BY third-party all fail.
- G4 sha256 grouping: duplicate fails, reported for both wraps.
- Types: VariantId/LicenceId derived from registries (closed enums); exhaustive `never` switch in cli/check.ts. Adding a Violation code without a formatter is a tsc error. `tsc --noEmit` passes.
- CLI tests pin exact stdout for the clean case and the too-big line.

## Non-blocking observation (evidence-backed, not a FAIL)
- O1: a file holding only the first 24 bytes of a valid PNG (signature + IHDR length/type/width/height, no IHDR tail, CRC, IDAT or IEND) passes: `check: 1 wrap, 0 violations`, exit 0 (logs/mutations.txt). This matches the design as written ("dims read from the IHDR chunk; no image library needed"), but a truncated commit would ship as a broken download. A cheap follow-up: require IHDR length == 13, a valid IHDR CRC, and an IEND chunk at EOF. The same applies to an all-space stem (`" .png"` is accepted), which Tesla's rule technically allows.

## Codex
Not run. Step 3 was a gate ("only if steps 1-4 pass") and it did not fully pass because one mutant survived (F1). Token cost: 0. My own deterministic probes above cover the requested focus areas instead: filename regex/unicode, byte boundary, truncated IHDR, load.ts error paths, licence/provenance logic. I'll do the single read-only Codex pass in round 2 once F1 is fixed.

## Counts
- Evidence-backed findings: 3 (1 blocking F1; 2 non-blocking: O1 truncated PNG, Q1 design-type deviation).
- Repeat issues across PRs (rule 7): none (first PR reviewed).

## Suggested next step
Build adds a ≥24-byte JPEG fixture and a bad-signature PNG fixture/test (F1), then pushes. Round 2 re-checks out the new head, re-runs the chain plus the magic-check mutant, and does the one Codex read. Eng Lead/Kai decide Q1 (require the own author vs amend §2.2) and whether to file the dependency-upgrade chore and the O1 PNG-integrity follow-up.
