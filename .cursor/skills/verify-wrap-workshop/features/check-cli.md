# Check the catalogue

The spec check reads `content/wraps` and reports how many wraps and violations it found.

## Sub-features

- `check-sample-clean` accepts the committed sample wrap.

## How to get to it (user POV)

- From the repository root, run `npm run check`.

## Driving it with the checker

Preconditions:

- `npm ci` finished in this run.
- `content/wraps/sample-solid-grey/` is the committed sample, unchanged.

- **Run the check.** Run `npm run check`. The exit code is 0. Stdout includes the `check:` line from `node .cursor/skills/verify-wrap-workshop/scripts/expected-counts.mjs`. That line counts directories in `content/wraps`.
- **Proof.** Copy stdout and the exit code to `/tmp/wrap-workshop-verify/check-cli.txt`.

## Gotchas

- npm prints its own script banner before the checker line. The required line is the `check:` line from `expected-counts.mjs`, not a hard-coded wrap count.
- Replacing `Solid Grey.png` with `test/fixtures/too-big.png` makes the same command exit 1. Restore `content/` before the next proof. A dirty `content/` tree is not a pass.
