# Review round 2 (final FAIL round): kk-ai-lab/tesla-wrap-workshop PR #2

- Head reviewed: 9df368fc5441985a64b298d4ebf1783dc24c7dcb. Fresh `git fetch`; `git rev-parse HEAD` and the PR API head.sha both match. Base origin/main 8420603 (unchanged).
- Node v22.23.4, npm 10.9.9. Run 2026-11-09 10:09–10:12 GMT (Europe/Dublin). Logs: ./logs/r2/
- Out of scope this round, not reported: dependency upgrades/audit, O1 (IHDR length/CRC/IEND), and the skill's missing too-big path.

## Verdict: FAIL (1 blocking finding, F2, same class as F1)

F1 is fixed and proven. Every check Eng Lead listed passes, including the optional-author mutant. One gap remains in claim (b): nothing tests the *non-empty* half of "required non-empty string". If the `.refine(trim)` is removed, all 22 tests still pass, and `npm run check` then accepts `author: ""` and `author: "   "`.

## F2 (blocking): the non-empty own-author rule has no killing test

- Files: `src/domain/wrap.ts:24` (`author: z.string().refine((value) => value.trim() !== "")`). The only test is `test/load.test.ts:159-177` ("rejects own provenance with no author"), and it covers only the *missing* key.
- Evidence (logs/r2/mutations.txt):
  - Mutant `author: z.string(),` → `npx vitest run` → `Tests 22 passed (22)` (survives).
  - Mutant `author: z.string().min(1),` (no trim) → `Tests 22 passed (22)` (survives).
  - With the `z.string()` mutant, `npm run check` with sample `author: ""` → `check: 1 wrap, 0 violations`, exit 0; with `author: "   "` → same, exit 0. On the real code the same inputs give `schema provenance.0.author Invalid input sample-solid-grey`, exit 1.
- Required change: add tests in test/load.test.ts for `author: ""` and `author: "   "` (an `it.each` over both is fine), each expecting a `schema` violation at `provenance.0.author`. Optional but cheap: give the refine a message (`{ message: "author must be non-empty" }`), so the CLI line says why instead of zod's default `Invalid input`.
- Guard: the two tests. Acceptance: both mutants above must fail at least one test.
- Repeat? **Yes. It is the same class as F1** ("a guard condition with no test that fails when it is removed"; F1 was the magic-byte check). Logged in fail-log.tsv. Per rule 7, I suggest a /correct task. Possible encodings: a short mutation script (e.g. `scripts/mutate-guards.mjs` that deletes each guard clause and asserts vitest fails), or Stryker scoped to src/domain. Eng Lead routes it to Build.

## Step 1: deterministic checks on the new head

- `npm ci && npm test && npm run check && npm run build` → exit 0: `Tests 22 passed (22)` (check-png 7, load 13, cli 2), `check: 1 wrap, 0 violations`, `[build] Complete!`.
- `npx tsc --noEmit -p .` → exit 0.
- dist/index.html lists `Solid Grey` → `/wraps/sample-solid-grey/Solid%20Grey.png`. The dist PNG is byte-identical to content. `node scripts/generate-pngs.mjs` regenerates every PNG with a clean tree, so the fixtures match their generator.
- Done-evidence: `too-big 1000001 bytes sample-solid-grey` / `1`; `git checkout content` → `Updated 1 path from the index`.

## Guard breaks (logs/r2/negatives.txt; restored after each; final tree clean)
| Guard | Break | Output | Exit |
|---|---|---|---|
| G1 | 1023x1024 | `wrong-dims 1023x1024 want 1024x1024` | 1 |
| G1 | JPEG 28 B JFIF | `not-png` | 1 |
| G1 | bad-signature.png | `not-png` | 1 |
| G1 | cybertruck at 1024x1024 | `wrong-dims 1024x1024 want 1024x768` | 1 |
| G1 | 27-char stem | `bad-name abcdefghijklmnopqrstuvwxyz1.png` | 1 |
| G1 | 20-byte truncated | `not-png` | 1 |
| G1 boundary | 26-char stem / exactly 1,000,000 B | `check: 1 wrap, 0 violations` (correct) | 0 |
| G2 | unknown variant / no title / stored width / id≠folder / bad JSON / no meta.json / missing file | `schema variant …`, `schema title Required`, `Unrecognized key(s) … 'width'`, `id-mismatch`, `invalid JSON`, `missing meta.json`, `missing file` | 1 each |
| G3 | MIT / PD / [] / no provenance / incomplete third-party / CC-BY+third-party | `schema licence …` ×2, `schema provenance …` ×2, `licence-provenance …` ×2 | 1 each |
| G4 | copy of the sample as second wrap | `dup-sha 8f0a39…` reported for both wraps | 1 |

## Step 3: author breaks (sample meta.json, restored after each)
| author | Output | Exit |
|---|---|---|
| removed | `schema provenance.0.author Required sample-solid-grey` | 1 |
| `""` | `schema provenance.0.author Invalid input sample-solid-grey` | 1 |
| `"   "` | same | 1 |
| `"\t\n"` | same | 1 |
| null | `schema provenance.0.author Expected string, received null` | 1 |
All exit 1 and name the field. The empty/whitespace message is zod's generic `Invalid input` (see the optional part of F2).
Mutant `author: z.string().optional()` → killed by "rejects own provenance with no author" (1 failed | 21 passed).

## Mutations (logs/r2/mutations.txt; src restored after each)
| Mutant | Result |
|---|---|
| R1 remove size check | killed (check-png too-big + CLI too-big) |
| R1 off-by-one size | killed (same 2) |
| R1 remove magic check | **killed now**: "rejects bad-signature.png" (renamed-jpeg still passes, see Step 2) |
| R1 name {1,26}→{1,27} | killed |
| R1 remove dims check | killed (1023x1024, cybertruck) |
| R1 width-only dims | killed (cybertruck) |
| extra: remove magic AND IHDR-tag check (length guard only) | killed: renamed-jpeg + bad-signature |
| extra: remove IHDR-tag check only | survives (not an AC item; magic now pins "PNG only") |
| author → optional | killed |
| author → `z.string()` | **survives (F2)** |
| author → `z.string().min(1)` | **survives (F2)** |
No `.skip/.only/.todo/xit`/empty expects.

## Step 2: the magic-byte mutation
With `!matches(bytes, 0, SPEC.pngMagic) ||` deleted, "rejects bad-signature.png" fails (1 failed | 21 passed), so F1 is closed. renamed-jpeg.png (28 B: `ff d8 ff e0 00 10 'JFIF\0' … ff fe 00 04 00 00 ff d9`) still passes under that mutant. It is ≥24 bytes, so it now reaches the IHDR-tag check (bytes 12–15 aren't `IHDR`), and Build's explanation is correct. That is fine: the JPEG test now proves "rejects JPEG content via the PNG structure checks", and bad-signature.png (valid.png with byte 0 0x89→0x76, everything else identical) proves the magic check specifically. If both checks are removed, the JPEG test fails too. Coverage is complete for the AC.

## Step 4: verification skill (logs/r2/skill-run.txt)
npm ci ok; build `Complete!`; preview `Local http://127.0.0.1:4173/`; `HTTP/1.1 200 OK`; pid file 143157 = listener on :4173; `v22.23.4`;
```
listed sample-solid-grey
link /wraps/sample-solid-grey/Solid%20Grey.png
file dist/wraps/sample-solid-grey/Solid Grey.png 3154 bytes
GET http://127.0.0.1:4173/wraps/sample-solid-grey/Solid%20Grey.png 200 image/png 3154 bytes
verify-site exit=0
check: 1 wrap, 0 violations   exit=0
```
Cleanup: pid killed, port refused (curl exit 7), pid file removed, proof files kept. The round-2 change touches no user path the skill covers beyond the sample meta (which still passes), so the skill needs no update.

## Step 5: diff audit
- `git diff --name-status origin/main...HEAD | wc -l` → **33** (matches Eng Lead and GitHub `changed_files: 33`). +1 vs round 1 = `test/fixtures/bad-signature.png`.
- `git diff --stat e4d379c5..HEAD` (1 commit, 9df368f "fix(check): cover the png signature and require an own author"):
```
 content/wraps/sample-solid-grey/meta.json |   2 +-
 scripts/generate-pngs.mjs                 |  22 +++++++++++++++++++++-
 src/domain/wrap.ts                        |   2 +-
 test/check-cli.test.ts                    |   2 +-
 test/check-png.test.ts                    |   8 +++++++-
 test/fixtures/bad-signature.png           | Bin 0 -> 3154 bytes
 test/fixtures/renamed-jpeg.png            | Bin 22 -> 28 bytes
 test/load.test.ts                         |  28 ++++++++++++++++++++++++++--
 8 files changed, 57 insertions(+), 7 deletions(-)
```
- All 8 files serve claims (a)/(b). Nothing unrelated, no lockfile or package.json change, no new non-fixture binary. The generator also gained a `jpeg.length < 24` throw (a guard for the F1 class).
- Comments: none added in the whole diff (only URL/glob false positives). No assertions removed or loosened. The changed expects only add assertions; the three `provenance: [{kind:"own"}]` → `+author` edits in test helpers follow the new required field and are not loosening.

## Codex (step 6): not obtained, 0 tokens
Ran from the checkout: `codex exec -s read-only -a never "<prompt>"` → `error: unexpected argument '-a' found` (exit 2; on CLI 0.166.0 `-a` is a top-level flag). Fallback `codex -a never exec -s read-only "<prompt>"` started (sandbox: read-only, approval: never), then exited 1: `ERROR: You've hit your usage limit … try again at Nov 12th, 2026 9:16 PM` (CLI local time; the box runs Europe/Dublin). No tokens-used line was printed, so the token cost is 0. I did not retry or work around it. Prompt saved at logs/r2/codex-prompt.txt.
To replace it, I ran my own deterministic probes on the same focus areas (logs/r2/probes.txt):
- A failing catalogue makes `npm run build` fail (`catalogue load failed`, exit 1, no dist/wraps), so the astro.config hook cannot copy a file that failed the checks. ✔
- Third-party entry with whitespace-only `sourceUrl` → `licence-provenance`, exit 1. ✔
- Non-blocking (not an AC breach; design §2.2 specifies only "YYYY-MM-DD" shape): `addedOn: "2026-02-31"` and `retrievedOn: "2026-13-99"` are accepted (exit 0), because DATE is a shape regex. Possible follow-up: a real date parse.
- Non-blocking (G5/no-rehost territory, I6): the wrap PNG may be a symlink to a file outside the repo; check accepts it (exit 0). Possible follow-up: `lstat` and reject symlinks in load.ts.

## Counts
- Evidence-backed findings: 3 (1 blocking F2; 2 non-blocking: date shape-only validation, symlinked PNG accepted).
- Repeat: F2 repeats F1's class → /correct suggested.

## Suggested next step
This was the last FAIL round, so Eng Lead decides. The fix is two small tests (plus an optional refine message). I'd ask Build for that one change and do a short re-verify: run the two author mutants and the chain, about 2 minutes, no Codex needed. In parallel, route a /correct task so that a guard without a killing test can't land again. Codex can be retried after Nov 12, 21:16 (Europe/Dublin) if a model read is still wanted.
