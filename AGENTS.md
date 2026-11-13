# Agent rules

| Rule | Enforcement |
| --- | --- |
| scanner-skips-input. A dist or comment-lint input kind must have a fixture the scanner check enforces. Opaque files, root skips, tags, and attributes are rows in `scannerInputKinds`. A path the table does not name fails closed. | `scripts/check-scanner-inputs.ts` and the kind-id list in `test/scanner-inputs.test.ts`, run from `npm test`. |
| test-does-not-pin-guard. A guard that a script can decide must have a test that fails when that guard is removed. | `npm run check:mutants` in CI. `findingReasons` is a closed map and `reasonMutants` sends each reason id to one floor mutant. `tsc` rejects any other reason. `scripts/check-guard-pins.ts` checks that map. |
