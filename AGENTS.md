# Agent rules

| Rule | Enforcement |
| --- | --- |
| scanner-skips-input. A dist or comment-lint input kind must have a bad fixture the scanner rejects. | `scripts/check-scanner-inputs.ts`, run from `npm test`. Dist kinds are `scannerInputKinds` in `scripts/check-dist.ts`. Comment-lint kinds are `commentLintKinds` in `eslint.config.js`. |
| test-does-not-pin-guard. A guard that a script can decide must have a test that fails when that guard is removed. | `npm run check:mutants` in CI. The list is `scripts/mutants.json`. Add one JSON object for a new guard. The script change is not required. |
