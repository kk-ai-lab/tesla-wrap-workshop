# PR #10 — independent review, round 1

## Verdict: FAIL

**Two evidence-backed findings:** the comment ban skips Astro source files, and its exception patterns admit arbitrary hack text. Local checks and the real GitHub Actions job pass, but acceptance criterion 3 is not met across `src/`.

- [PR #10](https://github.com/kk-ai-lab/tesla-wrap-workshop/pull/10), [issue #8 (I2)](https://github.com/kk-ai-lab/tesla-wrap-workshop/issues/8)
- Reviewed head: [`cfe92de895105a8ebfa55405f623cf7e8f028d8a`](https://github.com/kk-ai-lab/tesla-wrap-workshop/commit/cfe92de895105a8ebfa55405f623cf7e8f028d8a)
- Base worktree: `7aaff63b28d8d317276fa9f49935270027b04544` (`7aaff63`), also `origin/main` at fetch time
- Node **v22.23.4**, npm **10.9.9**
- Review run: **2026-11-11, 13:39–13:45 Europe/Dublin (GMT)**

Fresh clone, exact detached head and separate base worktree verified. All mutations were temporary and restored with `git checkout`; the disposable autofix probe was removed. Both worktrees are clean. No permanent source edits, commits, pushes, approvals, merges, or GitHub posts were made.

## Acceptance wording, read directly from issue #8

The issue says:

1. “`.github/workflows/ci.yml` runs on `pull_request` and on `push` to `main`, on Node 22: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run check`, `npm run build`.”
2. “`npm run typecheck` runs `tsc --noEmit` and passes on main.”
3. “`npm run lint` runs ESLint, passes on main, and fails when a comment is added to a file under `src/` (the team's no-comments rule).”
4. “CI on this PR's own head finishes green.”

The issue has **no exception allowing entire source-file types or arbitrary comments containing a licence word or URL**. The team's review principle permits upstream issue/RFC links and legal/licence text; those exceptions do not make unrelated hack explanations legal text.

| Criterion | Result |
|---|---|
| 1: triggers, Node, ordered steps | PASS |
| 2: typecheck script and main inputs | PASS |
| 3: ESLint/main baseline | PASS |
| 3: comment rejection across `src/` | **FAIL: findings A and B** |
| 4: real PR-head CI | PASS |

## A. FAIL — Astro files are excluded from the comment ban (gap a)

**File/line:** [eslint.config.js:20](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/cfe92de895105a8ebfa55405f623cf7e8f028d8a/eslint.config.js#L20).

```js
ignores: ["dist/**", ".astro/**", "content/**", "docs/**", "**/*.astro"],
```

The repository has a real source file at `src/site/pages/index.astro`. I tested each injection separately:

| Reproduction | Command | Actual result |
|---|---|---|
| Insert `<!-- hack -->` immediately before `<html lang="en">` | `npm run lint` | **Exit 0**, no diagnostic |
| Insert `// hack` after the opening frontmatter `---` | `npm run lint` | **Exit 0**, no diagnostic |
| Ask for that file's effective config | `npx --no-install eslint --no-warn-ignored --print-config src/site/pages/index.astro` | `undefined`, exit 0 |

Both are valid comment additions to a file under `src/`, not parse-error tricks. AC3's wording is not limited to TypeScript.

**Required change:** lint Astro files rather than ignoring them: configure an Astro-aware parser/processor (for example via `eslint-plugin-astro`) and enforce the ban for **both frontmatter JS and HTML comments**. Alternatively, Lead/Kai must explicitly approve narrowing AC3; the current issue does not authorize that narrowing.

**Required guard:** automated negative lint tests that inject both kinds into an Astro source fixture and require a comment-ban diagnostic/nonzero exit. Run them in CI so restoring `**/*.astro` to the ignore list fails a test.

## B. FAIL — substring allowlist bypasses the no-hack rule (gap b)

**File/line:** [eslint.config.js:5–15](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/cfe92de895105a8ebfa55405f623cf7e8f028d8a/eslint.config.js#L5-L15) and [line 48](https://github.com/kk-ai-lab/tesla-wrap-workshop/blob/cfe92de895105a8ebfa55405f623cf7e8f028d8a/eslint.config.js#L48).

`allowedPatterns` contains unanchored issue/RFC URLs and markers including `\bLicen[cs]e\b`. The installed plugin compiles these as regular expressions and uses `.test(commentText)`; matching **any substring** permits the entire comment.

Reproductions, separately prepended to `src/domain/spec.ts`:

```ts
// see https://github.com/foo/bar/issues/1 hack workaround
```

```ts
// Licence: this is a hack
```

For **each**: `npm run lint` exits **0**, with no diagnostic. In contrast, `// hack`, `/* workaround */`, and `/** hack workaround */` each exit **1** with:

```text
1:1  error  Comments are not allowed  ban-comments/ban-comments
```

The second bypass is not legal/licence text at all; it merely includes a matching word. The first admits arbitrary trailing hack prose because a URL occurs somewhere in the comment. The issue supplies no such broad exception, and the team's allowed comment categories do not authorize it. This is a concrete policy/AC3 gap, not a claim of an exploitable runtime vulnerability.

**Required change:** narrowly match the intended whole comment, not incidental words/substrings. Keep upstream-link exceptions bounded (reject unrelated trailing/prefix prose) and restrict legal exceptions to actual recognized notice forms rather than any occurrence of “Licence”, “Copyright”, or `(c)`. If broader prose exceptions are intended, Lead/Kai must approve that policy explicitly.

**Required guard:** CI-executed lint tests requiring both bypass strings to fail; positive controls should retain explicitly allowed bare upstream links and valid legal notices. Anchoring a single marker word alone is not sufficient to distinguish a legal notice from arbitrary hack prose.

## Gap decisions at a glance

| Gap | Evidence | Verdict impact |
|---|---|---|
| **(a) Astro excluded** | Both Astro mutations pass; effective config is undefined | **FAIL A** against AC3 |
| **(b) Unanchored exceptions** | Both hack-bearing TS comments pass | **FAIL B**; not an approved exception in the issue/team policy |
| **(c) ESLint major 9** | Installed 9.39.5, manifest `^9.39.5` (major-constrained, not exact version pin); plugin peer is `eslint: ">=6.0.0"` | **Not a finding.** The plugin does not require exactly ESLint 9. `typescript-eslint` accepts `^8.57.0 || ^9.0.0 || ^10.0.0`; the installed combination works. No forced upgrade requested. |
| **(d) Autofix deletes comments** | On a disposable source copy, `npx --no-install eslint --fix …` exits 0 and deletes `// hack` (only an extra blank line remains) | **Non-blocking observation.** `lint` is `eslint .`; no npm script or workflow command uses `--fix`. CI rejects ordinary comments rather than silently deleting them. Do not treat comment removal as the structural remedy for a workaround. |

## Local commands and key output

Every command below ran separately with its own captured exit code:

| Command on head | Output | Exit |
|---|---|---|
| `npm ci` | Installed 350 packages | 0 |
| `npm run lint` | `eslint .`, no diagnostics | 0 |
| `npm run typecheck` | `tsc --noEmit`, no diagnostics | 0 |
| `npm test` | `Tests 24 passed (24)` | 0 |
| `npm run check` | `check: 1 wrap, 0 violations` | 0 |
| `npm run build` | `output: "static"`; `1 page(s) built`; `Complete!` | 0 |

**“Passes on main” proof:** `git diff --exit-code 7aaff63 HEAD -- src test tsconfig.json vitest.config.ts` exits **0**. The source tree and typecheck inputs are unchanged; the successful head lint/typecheck run checks the same source as the requested main revision, using the new configuration. The base itself has no lint/typecheck npm scripts yet. Restored `npm run lint` also exits 0 after all mutations.

### Comment mutations

All source mutations below were restored separately and followed by a clean `git status --porcelain`.

| Injection | Location | `npm run lint` exit |
|---|---|---|
| `// hack` | `src/domain/spec.ts`, line 1 | **1**, named rule `ban-comments/ban-comments` |
| `/* workaround */` | same | **1**, same rule |
| `/** hack workaround */` | same | **1**, same rule |
| `<!-- hack -->` | `src/site/pages/index.astro`, HTML | **0** — A |
| `// hack` | same, frontmatter | **0** — A |
| `// see https://github.com/foo/bar/issues/1 hack workaround` | `src/domain/spec.ts` | **0** — B |
| `// Licence: this is a hack` | same | **0** — B |
| `// https://github.com/foo/bar/issues/1` | same, positive control | **0** |
| `// SPDX-License-Identifier: MIT` | same, positive control | **0** |

### Does CI test the comment-ban guard itself?

**No.** The workflow runs lint on clean committed code, plus the unchanged 24-test suite. It does not run any negative lint fixture or comment-injection regression test.

I proved the gap with a separate reversible mutation: changed `ban-comments/ban-comments` severity from `"error"` to `"off"` and added `// hack` to `src/domain/spec.ts`:

```text
npm run lint -> exit 0
npm test     -> Tests 24 passed (24), exit 0
```

Thus turning the guard off would escape the current lint/test stages. This repeats **F1/F2's “a guard whose removal no test catches” class**, although neither old PNG-signature nor author bug has returned. The review's manual mutations are evidence, not an enforced CI regression test. This is **not a third standalone acceptance failure**: the issue does not explicitly require mutation tests, but such tests are the guards requested for A/B and a suitable `/correct` follow-up.

## Workflow validation and security/scope audit

- Installed `@action-validator/cli` **0.6.0** outside the repository. From the checkout root: `action-validator .github/workflows/ci.yml && echo ok` prints **`ok`**, exit 0.
- Also installed **actionlint v1.7.12** outside the repository. `actionlint .github/workflows/ci.yml` exits **0**, no diagnostics.
- Triggers are `pull_request` and `push.branches: [main]`.
- `actions/setup-node@v4` sets `node-version: 22` and npm caching.
- The six npm commands are separate steps in the required order, with no `continue-on-error` or conditions skipping them.
- `permissions: { contents: read }` is explicit. Actual job logs show **Contents: read, Metadata: read**; there is no reliance on an unknown repository-default token policy.
- No `secrets.*` references or deployment steps.
- Both `actions/checkout@v4` and `actions/setup-node@v4` use **major-version tags**, not immutable SHAs. Non-blocking under the stated AC.

## Real GitHub Actions evidence

The requested command was attempted:

```sh
gh api repos/kk-ai-lab/tesla-wrap-workshop/commits/cfe92de895105a8ebfa55405f623cf7e8f028d8a/check-runs
```

The box's `gh` is not authenticated; it exited **4** before making the request. No credentials were read or authentication workarounds attempted. I verified the same check-runs endpoint using the connected GitHub tool, then fetched the job's individual steps and full log using that connector.

- [Run **43030610093**, job **130556359263** (`check`)](https://github.com/kk-ai-lab/tesla-wrap-workshop/actions/runs/43030610093/job/130556359263)
- `head_sha`: **cfe92de895105a8ebfa55405f623cf7e8f028d8a**
- Status **completed**, conclusion **success**
- **2026-11-11, 13:36:13–13:36:52 Europe/Dublin (GMT)**
- Every required command step individually reports **completed / success**, in this order: `npm ci`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run check`, `npm run build`.
- Logs independently show **node: v22.23.4**, **24 passed**, **check: 1 wrap, 0 violations**, and **Complete!**

This proves AC4 and that the job genuinely executed every step, rather than trusting only the aggregate green badge.

## Diff and lockfile audit

Both `git diff --name-status 7aaff63...HEAD` and `git diff --name-status origin/main...HEAD` return exactly:

```text
A  .github/workflows/ci.yml
A  eslint.config.js
M  package-lock.json
M  package.json
```

Manifest changes are two scripts plus three dev dependencies: ESLint **^9.39.5**, typescript-eslint **^8.72.2**, and eslint-plugin-ban-comments **^1.0.3**. Their installed versions are 9.39.5, 8.72.2, and 1.0.3 respectively.

Parsed both lockfiles rather than treating line churn as upgrades:

- **101 new package entries**, **0 removed**. All 101 are reachable from the three new lint dependency roots.
- Every added/changed package entry resolves from **https://registry.npmjs.org/** and has a **sha512 integrity** value.
- **No pre-existing package version, resolved URL, or integrity changes.** The only existing package metadata change is `semver` moving from `optional: true` to `devOptional: true`, consistent with its new lint dependency path.
- Root lock metadata adds the three dev dependencies and reconciles `engines.node` from stale `>=22` to `22.x`, which was already the base package.json value. Harmless metadata normalization, not an unrelated dependency upgrade.
- No added workaround/hack comments in the committed config/workflow diff, no unrelated source changes, and `git diff --check` passes. The YAML has no added comment text; YAML is not a `src/` comment target in any event.

## Verification skill

Read `.cursor/skills/verify-wrap-workshop/SKILL.md` and its feature files. Used this run's successful install/static build and started a new preview directly with Node 22. Verified the PID belonged to this checkout and matched the port-4173 listener.

```text
curl -sI http://127.0.0.1:4173/ -> HTTP/1.1 200 OK
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

The helper verifies HTTP bytes equal the built file. Killed only the verified preview process; confirmed it was gone and curl returned exit 7 (connection refused); removed the PID file and retained proof files. This PR changes tooling, not a user-facing path, so no stale-skill finding.

## Optional Codex read

After the deterministic command runs, workflow validators, mutation experiments, and site proof completed successfully, attempted exactly once:

```sh
codex -a never exec -s read-only "<short CI/lint diff review prompt>"
```

It exited **1** with the usage-limit message, retry time **2026-11-12 21:16 Europe/Dublin (GMT)**. No retry or workaround. **Token cost: not reported**; the CLI printed no `tokens used` line. No completed Codex pass and **no unverified model opinions** to report. This does not change FAIL to BLOCKED.

## Next step

Build should cover Astro comments and close the substring exceptions, with negative lint regression tests executed in CI. If either scope or allowed prose should be broader, Lead/Kai must approve the AC/policy change first. Re-review a fresh head and rerun the same comment matrix. Track the recurring missing-guard-test pattern through `/correct` rather than relying on repeated manual checks.

**Count: 2 evidence-backed blocking findings (A and B).** Both recorded in the review failure log. The autofix capability, ESLint major choice, action tag pinning, and missing automated negative test are separately labeled observations, not additional FAIL items.

Local logs retained alongside this report include `head-checks.txt`, `identity-diff.txt`, `mutation-*.txt`, `guard-disabled.txt`, `fix-probe.txt`, `validation-main-equivalence.txt`, `ci-evidence.txt`, `lockfile-audit.txt`, and `verification-skill.txt` under `logs/`.
