# PR #7 — independent review, round 1

## Verdict: PASS

Both regression tests catch the original F2 problem. No evidence-backed defects found (**0 findings**). All four acceptance criteria pass. The optional Codex read was unavailable because of its usage limit; this does not block the verdict.

- **PR:** [#7](https://github.com/kk-ai-lab/tesla-wrap-workshop/pull/7)
- **Issue:** [#4](https://github.com/kk-ai-lab/tesla-wrap-workshop/issues/4), follow-up to F2 in the [PR #2 review](https://github.com/kk-ai-lab/tesla-wrap-workshop/pull/2)
- **Head reviewed:** [`0348e519f85ff1080614d6cecf707c5242a14eee`](https://github.com/kk-ai-lab/tesla-wrap-workshop/commit/0348e519f85ff1080614d6cecf707c5242a14eee)
- **Base tested:** `b798a2347f9f15f842b7e5f42dd20244b1359ded` (`b798a23`), also `origin/main` at fetch time
- **Environment:** Node **v22.23.4**, npm **10.9.9**
- **Review:** 2026-11-11, 13:00–13:02 **Europe/Dublin (GMT)**

## What was done

Cloned the repository afresh, fetched PR #7, and checked out the exact requested head in detached mode. Kept a separate worktree at the requested base. Ran the base and head suites, sanity checks, both specified schema mutations on **both** revisions, and the repository verification skill. Read the complete one-file diff and checked assertion strength, scope, and added comments.

No permanent source edits, commits, pushes, approvals, merges, or GitHub posts were made. Each temporary mutation was restored with `git checkout -- src/domain/wrap.ts`; `git status --porcelain` was empty after every restoration and at completion. The report and logs are outside the checkout.

## 1. Scope and identity

`git rev-parse HEAD` returned the exact head above. Both comparisons agree:

```text
$ git diff --name-status b798a23...HEAD
M       test/load.test.ts
$ git diff --name-status origin/main...HEAD
M       test/load.test.ts

$ git diff --stat b798a23...HEAD
 test/load.test.ts | 42 ++++++++++++++++++++++++++++++++++++++++++
 1 file changed, 42 insertions(+)
$ git diff --numstat origin/main...HEAD
42      0       test/load.test.ts
```

**Acceptance criterion 4 passes:** exactly one test file, +42/−0. No production code, configuration, fixture, or unrelated file changes. `git diff --check b798a23...HEAD` also exits 0.

## 2. Base and head checks

Commands ran with Node 22 at the appropriate checkout root.

| Revision / command | Key output | Exit |
|---|---|---|
| Base: `npm ci && npm test` | `Tests 22 passed (22)` | 0 |
| Head: `npm ci && npm test` | `Tests 24 passed (24)`; load tests increase from 13 to 15 | 0 |
| Head: `npm run check` | `check: 1 wrap, 0 violations` | 0 |
| Head: `npm run build` | `output: "static"`, `1 page(s) built`, `Complete!` | 0 |
| Head: `npx --no-install tsc --noEmit` | No diagnostics | 0 |
| Head after restoring all mutations: `npm test` | `Tests 24 passed (24)` | 0 |

The complete head sequence was `npm ci && npm test && npm run check && npm run build && npx --no-install tsc --noEmit`, exit 0.

## 3. Assertions and guards added

The production guard is unchanged at [src/domain/wrap.ts:24](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/0348e519f85ff1080614d6cecf707c5242a14eee/src/domain/wrap.ts#L24):

```ts
author: z.string().refine((value) => value.trim() !== ""),
```

The added tests are:

1. [test/load.test.ts:180–199](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/0348e519f85ff1080614d6cecf707c5242a14eee/test/load.test.ts#L180-L199): **“reports a schema violation when the own author is empty”**, with `author: ""` and wrap id `own-empty-author`.
2. [test/load.test.ts:201–220](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/0348e519f85ff1080614d6cecf707c5242a14eee/test/load.test.ts#L201-L220): **“reports a schema violation when the own author is whitespace”**, with `author: "   "` and wrap id `own-blank-author`.

Each calls the real `loadCatalogue` on a separate temporary root containing valid metadata and an actual fixture PNG. Both first assert:

```ts
expect(result.ok).toBe(false);
```

Then, inside `if (!result.ok)`, the empty-author test asserts:

```ts
expect(
  result.violations.some(
    (violation) =>
      violation.code === "schema" &&
      violation.path === "provenance.0.author" &&
      violation.wrap === "own-empty-author",
  ),
).toBe(true);
```

The whitespace test has the same predicates, with `violation.wrap === "own-blank-author"`.

These are not generic “something failed” assertions: they require the **schema** violation kind, the exact **provenance.0.author** path, and the matching wrap id. The preceding `expect(result.ok).toBe(false)` prevents the conditional block from letting an accepted catalogue pass silently. The existing helper removes each temporary root in `finally`.

**Acceptance criteria 1 and 2 pass.** No existing assertion was removed or loosened. No added workaround/hack comments, skipped/focused tests (`.skip`/`.only`), `.todo`, or empty expectations were found in the additions.

## 4. Mutation proof: before and after

For each revision, temporarily replaced **only** the own-author schema expression, ran `npm test -- --reporter=verbose`, restored with `git checkout -- src/domain/wrap.ts`, and confirmed a clean tree.

| Mutation | Before: base `b798a23` | After: PR head |
|---|---|---|
| Refine → `z.string()` | **22 passed**, exit 0: regression escapes | **2 failed, 22 passed**, exit 1: both new tests catch it |
| Refine → `z.string().min(1)` | **22 passed**, exit 0: trim regression escapes | **1 failed, 23 passed**, exit 1: new whitespace test catches it; empty test still passes |

Key output with `z.string()` on the head:

```text
× reports a schema violation when the own author is empty
  → expected true to be false
× reports a schema violation when the own author is whitespace
  → expected true to be false
Tests  2 failed | 22 passed (24)
```

Failures occur at the new `result.ok` assertions, lines 187 and 208: removing the guard incorrectly accepts each catalogue, and the tests detect that acceptance.

Key output with `z.string().min(1)` on the head:

```text
✓ reports a schema violation when the own author is empty
× reports a schema violation when the own author is whitespace
  → expected true to be false
Tests  1 failed | 23 passed (24)
```

**Acceptance criterion 3 passes.** Each new test has a demonstrated regression it catches. Together they close F2: mere presence and non-zero length are insufficient; whitespace-only values must remain rejected.

## 5. Verification skill

Read `.cursor/skills/verify-wrap-workshop/SKILL.md` and its feature files. Used the install and static build completed in this run, then started a new preview directly:

```sh
node ./node_modules/astro/bin/astro.mjs preview --host 127.0.0.1 --port 4173
```

Verified the process belonged to this checkout, recorded its node PID, and confirmed that PID was the listener on port 4173.

```text
Ready: Local http://127.0.0.1:4173/
$ curl -sI http://127.0.0.1:4173/
HTTP/1.1 200 OK
$ node -v
v22.23.4

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

The helper verifies the fetched download matches the built file byte-for-byte. Cleanup killed only this run's verified node process; the process disappeared and curl returned exit 7 (connection refused). The PID file was removed and proof files retained. Tests alone changed, so no verification-skill update is needed.

## 6. Optional Codex read and unverified opinions

After all deterministic checks passed, attempted exactly once:

```sh
codex -a never exec -s read-only "<short test-diff review prompt>"
```

The prompt scoped the read to the new tests, helpers, assertion strength, and test-only scope. The CLI exited 1 with:

```text
ERROR: You’ve hit your usage limit. … try again at Nov 12th, 2026 9:16 PM.
```

The quoted retry time is **2026-11-12 21:16 Europe/Dublin (GMT)** in this box's local configuration. No retry or workaround was attempted. No review opinions were produced.

**Codex token cost:** not reported by the CLI; no `tokens used` line was printed. No completed Codex pass. This optional-tool failure does not change PASS to BLOCKED.

**Unverified opinions:** none relied on or included as findings.

## Outcome and next step

- **Evidence-backed defect findings: 0.** No failure-log entry added.
- **Original F2:** closed by two focused tests; both mutations that escaped the base suite are caught on the PR head.
- **Next step:** Eng Lead can use this PASS for the normal approval/merge process. No code changes are requested by this review, and no approval or merge was performed here.

Local evidence retained alongside this report: `logs/identity-diff.txt`, `logs/test-diff.patch`, `logs/base-tests.txt`, `logs/head-checks.txt`, `logs/base-mutant-{plain-string,min-one}.txt`, `logs/repo-mutant-{plain-string,min-one}.txt`, `logs/head-after-restoration.txt`, and `logs/verification-skill.txt`.
