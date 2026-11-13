# PR 36 review, round 1

**PR.** https://github.com/kk-ai-lab/tesla-wrap-workshop/pull/36 (draft). It fixes issue 35, which tracks the PR 34 review findings L1 and L2.
**Head reviewed.** `3d2a4b2f52e3dba8c87faaef58c6beefd6be388b`. The GitHub API returned this SHA as the PR head before the review started.
**Base.** main `50d42ed`, which is also the merge base. The diff has 3 files, +158/−3, matching the PR metadata. The files are `scripts/check-mutants.ts`, `scripts/probe-mutant-holes.ts` and `test/check-mutants.test.ts`.

## Goal

`npm run check:mutants` must not report a pass when a guard is unpinned. PR 34 left two holes:
- **L1.** A stale report from an earlier mutant could credit a kill to a test that never ran.
- **L2.** An empty or shortened mutant list passed.

## Verdict: PASS for 3d2a4b2

All five acceptance criteria hold with evidence.
- The literal L1 repro from PR 34 now exits 1.
- An unparseable report exits 1. This was tested with real vitest.
- An empty list exits 1. A list missing M1, M6 or M7 exits 1.
- The new tests fail against the 50d42ed checker and pass on head.

There is 1 evidence-backed finding, rated Low and non-blocking. The PR dropped the exit-status cross-check (F1). It is not a FAIL item.

## Evidence

Logs are under `logs/` in the review folder. Probes ran in separate worktrees at 3d2a4b2, and each one was restored to an empty porcelain.

### Lint, typecheck and test

| Step | base 50d42ed | head 3d2a4b2 |
|---|---|---|
| `npm ci` | 0 | 0 |
| `npm run lint` | 0 | 0 |
| `npm run typecheck` | 0 | 0 |
| `npm test` | 0, 10 files, 146 tests | 0, 11 files, **149 tests** |
| `npm run check:mutants` | n/a | **0** (M1, M6, M7 killed, 18.3s) |

### AC1, L1 stale and unparseable reports

**Literal PR 34 repro.** `mutants.json` was set to `[M6, STALE]`. STALE shares M6's `kills` and breaks `package.json` (`logs/probes/L1-literal-pr34.txt`).

```
scripts/mutants.json is missing M1
check:mutants 0.3s
EXIT=1
```

The required-id check now stops that literal list early. So I re-ran the same STALE mutant with M1, M6 and M7 kept, so that the run reaches the report path. This is the deciding run, and it uses real vitest (`logs/probes/L1-with-required-ids.txt`).

```
M1 killed (1 failed)
M6 killed (2 failed)
M7 killed (1 failed)
STALE error
expected test/page-policy.test.ts > blocks a public build when the inventory was regenerated but the approved hash is old
ENOENT: no such file or directory, open '/tmp/check-mutants-…/mutant-report.json'
failed to load config from /tmp/check-mutants-…/vitest.config.ts
check:mutants 18.1s
EXIT=1
```

In PR 34, the same mutant printed `STALE killed (2 failed)` with EXIT=0.

**Unparseable report.** I wrapped real vitest so that each JSON report is cut in half after it is written. A copied `node_modules` was used and restored afterwards (`logs/probes/L1-unparseable-report.txt`).

```
M1 error
Unterminated string in JSON at position 18530 (line 1 column 18531)
M6 error
Unterminated string in JSON at position 19358 (line 1 column 19359)
M7 error
Unterminated string in JSON at position 18856 (line 1 column 18857)
check:mutants 17.9s
EXIT=1
```

### AC2, L2 short lists

| `mutants.json` | Output | Exit |
|---|---|---|
| `[]` | `scripts/mutants.json is empty` | 1 |
| without M1 | `scripts/mutants.json is missing M1` | 1 |
| without M6 | `scripts/mutants.json is missing M6` | 1 |
| without M7 | `scripts/mutants.json is missing M7` | 1 |

The outputs are in `logs/probes/L2-*.txt`.

### AC3, the new tests against the old checker

In a worktree, I replaced `scripts/check-mutants.ts` with the 50d42ed version (`logs/probes/old-checker-test.txt`).

```
× rejects a stale vitest report when vitest does not run
× rejects an empty mutant list
× rejects a mutant list that drops M6
AssertionError: expected +0 to be 1 // Object.is equality   (all three)
Tests  3 failed (3)
EXIT=1
```

`npm test` in that worktree reports `Tests 3 failed | 146 passed (149)`, EXIT=1. On the head checker, the result is `Tests 3 passed (3)`, EXIT=0.

**Each fix piece is pinned by its own test.** I removed each piece of the fix from the head checker and re-ran the new tests (`logs/probes/fix-revert-mutations.txt`).

| Removed | New tests |
|---|---|
| `rmSync(reportPath)` (`check-mutants.ts:119`) | 1 failed, the stale test |
| Empty-list check (`:43`) | 1 failed, the empty test |
| Required-id loop (`:62-64`) | 1 failed, the drops-M6 test |
| `status === null` branch (`:151`) | 0 failed (see opinions) |

### AC4, exit 0 and porcelain

Output from `logs/porcelain.txt` follows.

```
tmp before: 0
failing run exit=1
porcelain after failing run (only the deliberate probe edit expected):
 M scripts/mutants.json
porcelain after restore lines=0
passing run (repo) exit=0
repo porcelain lines=0
npm test (repo) exit=0; porcelain lines=0
tmp after: 0
```

The failing run was the STALE probe with real vitest. It changed nothing beyond the deliberate `mutants.json` edit, and it left no `/tmp/check-mutants-*` or `/tmp/mutant-hole-*` directory behind.

### AC5, unchanged paths

`git diff 50d42ed 3d2a4b2` is 0 lines across these paths:
- `scripts/release-gate.ts`
- `src/domain/launch.ts`
- `src/site/pages/robots.txt.ts`
- `scripts/check-page-policy.ts`
- `eslint.config.js`
- `.github/`
- `package.json`
- `package-lock.json`
- `scripts/mutants.json`

### Diff hygiene

- **Workaround or hack comments.** None. The keyword scan and the comment-syntax scan of added lines both found 0 hits.
- **Unrelated files.** None. All 3 files serve L1 or L2.
- **Loosened assertions.** The diff removes three lines, and one of them is a loosened check, reported as F1.
  - `return parsed.map(` became `const mutants =`. This is a refactor.
  - The label `survived` became `error`. The exit is still 1.
  - `return result.status !== 0;` became `return true;`. That is F1.

## Findings

There is 1 evidence-backed finding, rated Low and non-blocking.

| # | Severity | Where | Evidence | Required change | Guard |
|---|---|---|---|---|---|
| F1 | Low | `scripts/check-mutants.ts:158`, formerly `return result.status !== 0;` | The PR removed the exit-status cross-check. I made a fake vitest that writes a report listing the kill test as failed and then exits 0. The head checker prints `M1/M6/M7 killed` and exits 0. The 50d42ed checker exits 1 (`logs/probes/report-failed-but-exit0.txt`). Real vitest exits non-zero whenever a test fails, so this cannot happen today. Still, a contradictory run now passes where it used to fail. | Keep `status !== 0` as a requirement for a kill, and print `error` when the report and the exit code disagree. | Add a fourth `probe-mutant-holes.ts` scenario, "report failed, exit 0", that expects exit 1. |

## New guards, and whether each catches its original problem

| Guard | Original problem | Caught? |
|---|---|---|
| `rmSync(reportPath)` before each run, with a missing or unparseable report treated as an error | L1, a kill credited from a stale report | Yes. The literal PR 34 mutant gives `STALE error` and exit 1. Unparseable reports give exit 1 with real vitest. |
| Empty-list check | L2, `[]` passed | Yes, exit 1. |
| Required ids M1, M6 and M7 | L2, a dropped entry passed | Yes. Each missing id gives exit 1. |
| `test/check-mutants.test.ts` plus `probe-mutant-holes.ts` inside `npm test` | Keeping L1 and L2 fixed | Yes. Three tests fail on the old checker, and each fix piece is pinned by one test. The probes use a fake vitest, so the real-vitest runs above are the deciding evidence. |

## Unverified opinions

These are Codex points I did not reproduce, plus notes of my own. None is a finding.
- **Codex.** `check-mutants.ts:145` never checks that the kill test passes on the unmutated project. A test that is already failing would count as a kill. CI runs `npm test` before `check:mutants`, which mitigates this. That ordering is my inference from `ci.yml`.
- **Codex.** `check-mutants.ts:107` matches tests by file plus leaf title only. Same-titled tests in different `describe` blocks could share credit. This is the same point Codex raised in PR 34. There are no duplicates today.
- **Codex.** The required ids are hard-coded to three. A future guard M8 could be dropped silently. New mutants are out of scope for this PR.
- **Mine.** The `status === null || result.error` branch at `:151` is not pinned by a test (revert R4 passes 3/3). With the report deleted before each run, a timeout without a report already errors through the parse path. The branch is defence in depth.
- **Mine.** A required id only proves an entry with that id exists. It does not prove the entry still mutates the right guard. Pinning each required id's `file` would close that gap.

## Codex cost

I ran it once with `codex -a never exec -s read-only` and a short prompt aimed at remaining false-pass paths. It reported `tokens used 20,232` (`logs/codex.txt`). I did not retry. All of its points remain unverified.

## Count

There is 1 evidence-backed finding (Low) and 0 FAIL items. Nothing was appended to `fail-log.tsv`.

## Suggested next step

Restore the exit-status requirement and add the "report failed, exit 0" probe scenario. This is about four lines across two files. Then mark the PR ready. F1 does not block merge.
