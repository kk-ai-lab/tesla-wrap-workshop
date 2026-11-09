# Wrap workshop verification map

This directory is the source for verifying tesla-wrap-workshop. Read it before driving the app, then follow the feature file.

## Baseline preconditions

- The repository root is the working directory.
- `npm ci` and `npm run build` have completed in this run.
- Preview, when a feature needs it, is `http://127.0.0.1:4173` and this run started it.
- Node is 22, matching `.nvmrc`.

## Driving conventions

- Start from the committed sample wrap `sample-solid-grey`. Do not edit `content/` during a proof.
- Treat commands as literal.
- Run the site check through `node scripts/verify-site.mjs`.
- Run the checker through `npm run check`.
- Do not delete proof files during cleanup.

## Proof and skip reporting

- Capture the command and the resulting status, not only the last screen.
- A download proof includes the HTTP status, the content type, and a byte match against `dist/`.
- A checker proof includes stdout and the exit code.
- Report an unreachable path with the command you ran and the unmet precondition.

## Features

- [Download the sample wrap](./download-sample.md) covers the index listing and the PNG download.
- [Check the catalogue](./check-cli.md) covers the local spec check for the committed sample.
