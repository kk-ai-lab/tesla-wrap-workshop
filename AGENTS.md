# Agent rules

| Rule | Enforcement |
| --- | --- |
| test-does-not-pin-guard. A guard that a script can decide must have a test that fails when that guard is removed. | `npm run check:mutants` in CI. The list is `scripts/mutants.json`. Add one JSON object for a new guard. The script change is not required. |
