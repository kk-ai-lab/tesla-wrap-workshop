# PR 34 review, round 1

**PR.** https://github.com/kk-ai-lab/tesla-wrap-workshop/pull/34 (draft). It fixes issue 33.
**Head reviewed.** `cb3247e755478c40fd091a98485dc028579040ad`. The GitHub API confirmed this SHA as the PR head before the review started.
**Base.** main `78827b3`. The merge base is `e56b2d7`. The PR diff `e56b2d7..cb3247e` has 12 files, +422/−13, which matches the PR metadata. Commit `78827b3` itself touches docs only.

## Goal

The main-e56b2d7 audit found three guards that tests did not pin.
- M1 is the PNG CRC check.
- M6 is the release-gate hash check.
- M7 is the release-gate sign-off check.

It also found that the verify skill used stale hard-coded counts.

This PR should pin those guards, keep them pinned in CI, and make the skill derive its counts. The PR adds four things:
- three tests
- a data-driven mutant runner in CI
- two skill helper scripts
- one ESLint globals entry

## Verdict: PASS for cb3247e

All five acceptance criteria hold with evidence. There are 2 evidence-backed findings, both Low and non-blocking. Both are runner-hardening follow-ups. Codex raised them, and I reproduced each one. Nothing in this PR is a FAIL item.

## Evidence

Logs live under `logs/` in the review folder.

### 1. Lint, typecheck and test on base and head

| Step | base 78827b3 | head cb3247e |
|---|---|---|
| `npm ci` | 0 | 0 |
| `npm run lint` | 0 | 0 |
| `npm run typecheck` | 0 | 0 |
| `npm test` | 0, 10 files, 142 tests | 0, 10 files, **146 tests** |
| `npm run check:mutants` | n/a | **0** |

The head's `check:mutants` output follows (`logs/repo-chain.txt`).

```
M1 killed (1 failed)
test/load.test.ts > rejects a PNG whose only defect is a bad IEND CRC
M6 killed (2 failed)
test/page-policy.test.ts > blocks a public build when the approved catalogue hash is missing
test/page-policy.test.ts > blocks a public build when the inventory was regenerated but the approved hash is old
M7 killed (1 failed)
test/page-policy.test.ts > blocks a public build when legal sign-off is empty and the catalogue hash is current
check:mutants 17.5s
EXIT=0
```

### 2. Guard off exits 1

Each probe ran in its own worktree at cb3247e.

First probe. The M1 test was reverted to its state at `53c5774` (`logs/probes/guardoff-M1-test-reverted.txt`).

```
M1 survived
expected test/load.test.ts > rejects a PNG whose only defect is a bad IEND CRC
M6 killed (2 failed)
M7 killed (1 failed)
check:mutants 17.7s
EXIT=1
```

Second probe. All of `test/` was taken from e56b2d7, the audited main (`logs/probes/guardoff-e56b2d7-tests.txt`).

```
M1 survived
M6 survived
M7 survived
check:mutants 17.3s
EXIT=1
```

Third probe. M6's search string no longer matches, because `!==` became `!=` in `mutants.json` (`logs/probes/missing-search.txt`).

```
M1 killed (1 failed)
M6: search text found 0 times in scripts/release-gate.ts
check:mutants 6.1s
EXIT=1
```

**Determinism.** I ran `check:mutants` three times on a clean head worktree. The three outputs, minus the timing line, have the same md5 (`90d869e5…`). Each run exited 0. No `/tmp/check-mutants-*` directory was left behind, and the porcelain stayed empty.

**CI claim for run 43496164216.** The claim is verified. The run's head is `53c5774`, "test(png): drop the IEND crc pin". Its conclusion is failure, and the failing step is `npm run check:mutants`. The job log tail (`logs/ci-run-43496164216-excerpt.txt`) reads as follows.

```
Tests  145 passed (145)
M1 survived
expected test/load.test.ts > rejects a PNG whose only defect is a bad IEND CRC
M6 killed (2 failed)
M7 killed (1 failed)
##[error]Process completed with exit code 1.
```

Head cb3247e has the CI check `check` with conclusion success (run 43496381992).

### 3. Porcelain

```
$ git -C repo status --porcelain
$ echo "porcelain-lines=$(git -C repo status --porcelain | wc -l)"
porcelain-lines=0
```

The porcelain was empty after the chains, after `check:mutants`, and after the full skill run. Every probe worktree was restored to an empty porcelain as well.

### Acceptance criteria

1. **F2.** Under M6 the test "inventory was regenerated but the approved hash is old" fails. Under M7 the test "legal sign-off is empty and the catalogue hash is current" fails. Both tests pass the complete refusal strings to `toThrow` (`test/page-policy.test.ts:147-148`).
2. **F3.** The fixture differs from `valid.png` by one byte, at offset 3150, which is the IEND CRC (`logs/probes/crc-fixture-only-defect.txt`).
   - `sharp` with the same options as `verifyPngIntegrity` accepts the file.
   - `verifyPngIntegrity` on head returns `false`.
   - With M1 applied, `verifyPngIntegrity` returns `true`.
   - The test also asserts that sharp accepts the file (`test/load.test.ts:432`).
3. **F4.** `expected-counts.mjs` prints these lines.
   - `check: 13 wraps, 0 violations`
   - `verify-gallery: 12 variant pages, 13 wrap pages, 13 thumbnails, 12 index links ok`
   - `links: 12 template links ok, 0 tesla hotlinks`

   I added a 14th wrap directory in a scratch worktree. The script then printed `check: 14 wraps`. The skill no longer calls `lsof` or `ps`. This box has no `lsof`, and the skill still ran end to end (section 5).
4. **check:mutants.**
   - It runs in CI right after `npm test` (`.github/workflows/ci.yml:25`).
   - The mutant list is data in `scripts/mutants.json`.
   - It is deterministic, and the three runs above match.
   - It works in a temp copy and never dirties the tree.
   - A missing search string fails loudly with exit 1.
   - CI fails when a mutant survives.
5. **Unchanged logic.** `git diff e56b2d7 cb3247e` is empty for five files.
   - `scripts/release-gate.ts`
   - `src/domain/launch.ts`
   - `src/site/pages/robots.txt.ts`
   - `scripts/check-page-policy.ts`
   - `src/catalogue/png-integrity.ts`

   **ESLint.** I compared `eslint --print-config` output on base and head for a script `.mjs`, an `.astro` page, and a skill `.mjs`. In all three, the rule sets are identical, with 87, 92 and 87 rules and 0 changed. `noInlineConfig` is `true` on both. The only difference is five added globals on skill `.mjs` files: `Buffer`, `URL`, `console`, `fetch` and `process`.

   A probe `.mjs` under `.cursor/skills/` still fails on three counts (`logs/probes/eslint-skill-probe.txt`).
   - `// hack` is reported by `ban-comments`.
   - `/* eslint-disable */` gets the noInlineConfig "has no effect" warning, and ban-comments also reports it.
   - An undefined identifier is reported by `no-undef`.

### 5. verify-wrap-workshop skill, end to end

I followed the updated SKILL.md literally.
- `npm run verify` exited 0. That covers 146 tests, e2e (6 passed) and e2e-dev (1 passed).
- I launched the preview and found its listener with `preview-listener.mjs pid 4173`, which returned 650757. The script's `command` and `cwd` output matched this run and this checkout.
- The doctor checks passed. The server returned 200, the pid file existed, `open` exited 0, the listener matched the pid file, and node was v22.23.4.
- `verify-site.mjs` passed with `GET …/Solid%20Grey.png 200 image/png 3154 bytes`.
- I checked each line from `expected-counts.mjs` and found it in the real `check`, `verify-gallery` and `links` output.
- `check:dist` exited 0 and full `postbuild:check` exited 0.
- I opened `/`, `/models/model3/`, `/wraps/sample-solid-grey/`, `/about/` and `/wraps/cobalt-pulse/` on desktop and mobile. Every page returned 200, carried `noindex,nofollow` and showed the disclaimer. There were 0 console errors (`logs/screens/`).
- Cleanup worked. The stored PID matched the listener, it exited when killed, and `open 4173` then exited 1. I removed the pid file.

### 6. Diff hygiene

- **Workaround or hack comments.** None. The keyword scan of added lines found 0 hits. The comment-syntax scan found one false positive, the `/**/` glob in `eslint.config.js`.
- **Unrelated changes.** None. All 12 files serve F2, F3, F4 or the runner. `AGENTS.md` records the new rule.
- **Loosened assertions.** None. The `test/` diff only adds lines, with 0 deletions, and no existing expectation changed.
- **History.** `53c5774` drops the M1 test and `cb3247e` reverts that drop. This was the deliberate CI demonstration, and it nets to zero.

## Findings

There are 2 evidence-backed findings, both Low and non-blocking. Codex raised both, and I reproduced each one before listing it.

| # | Severity | Where | Evidence | Required change | Guard |
|---|---|---|---|---|---|
| L1 | Low | `scripts/check-mutants.ts:110,146` | The runner reuses `mutant-report.json` across mutants and never deletes it. I added a mutant `STALE` that shares M6's `kills` but breaks `package.json`, so vitest never runs. The runner still printed `STALE killed (2 failed)` with M6's test names, and the run exited 0 (`logs/probes/codex1-stale-report.txt`). A kill is credited to a test that never ran. The current three mutants have distinct `kills`, so they are not affected today. | Delete the report before each run. Treat a missing or unparsable report, or `result.status === null`, as an explicit error rather than a kill. | Add a runner self-test with one mutant that crashes vitest. It must not report "killed" from earlier data. |
| L2 | Low | `scripts/check-mutants.ts:39-60` | `[]` in `scripts/mutants.json` gives `check:mutants 0.3s` and EXIT=0 (`logs/probes/codex3-empty-list.txt`). Deleting any one entry also passes, so "keep them pinned" rests on review alone. | Fail on an empty list. Better, keep a required id set (M1, M6, M7) that only an explicit change can drop. | The runner fails when a required id is absent. |

## New guards, and whether each catches its original problem

| Guard | Original problem | Caught? |
|---|---|---|
| `test/load.test.ts` "only defect is a bad IEND CRC" | F3, M1 survived | Yes. It kills M1 locally and in CI run 43496164216. Sharp alone accepts the fixture. |
| `test/page-policy.test.ts` "regenerated but approved hash is old" | F2, M6 survived. This is the project's own 2026-11-12 P2 case. | Yes. It kills M6 and survives with e56b2d7's tests. |
| `test/page-policy.test.ts` "sign-off empty, hash current" | F2, M7 survived | Yes. It kills M7. |
| `test/page-policy.test.ts` "approved hash missing" | Hash line absent | Yes. M6 also fails it. It is not M7-specific. |
| `npm run check:mutants` in CI | `test-does-not-pin-guard` recurring with no structural check | Yes for removal of a pinning test, as the CI run, the local revert and e56b2d7's tests show. It does not catch removal of the mutant entries themselves (L2). |
| `expected-counts.mjs` | F4, hard-coded wrap count | Yes. It printed 13 today and 14 after a directory was added. |
| `preview-listener.mjs` | F4, `lsof` dependency | Yes. The skill ran end to end on a box without `lsof`. |

## Unverified opinions

These are Codex output that I did not reproduce, plus one judgement of my own.
- **Codex.** `check-mutants.ts:101` matches tests by file plus leaf title. Two tests with the same title in different `describe` blocks could share credit. No such duplicates exist today.
- **Codex.** `check-mutants.ts:138` counts any failure of the named test as a kill. A mutant that leaves the guard in place but throws a different error would count as killed. Mutants are reviewed data, so this risk rests on review.
- **Mine.** Vitest's `toThrow(string)` checks that the message contains the string. The tests pass the complete messages, so the criterion is met. `toThrow(new RegExp(\`^${escape(msg)}$\`))` would also reject added suffixes.
- **Mine.** Squash `53c5774` and its revert on merge to keep main's history clean.

## Codex cost

I ran it once with `codex -a never exec -s read-only`, using a short prompt aimed at the runner and the tests. It reported `tokens used 24,963` (`logs/codex.txt`). I did not retry. Its output stayed unverified until I reproduced points 1 and 3, which became L1 and L2.

## Count

There are 2 evidence-backed findings, both Low, and 0 FAIL items.

## Suggested next step

Fix L1 and L2 in this PR or in a small follow-up. Each is a few lines in `check-mutants.ts` plus a runner self-test. Then mark the PR ready. The fixes are not required for merge.
