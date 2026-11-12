# tesla-wrap-workshop

Curated PNG designs for Tesla Paint Shop's on-screen vehicle visualization. Choose a vehicle variant, read a design's provenance, and download the original PNG. The current catalogue contains one development sample. v1 has no visitor uploads.

Not affiliated with, endorsed by or sponsored by Tesla, Inc.

## Development

From the repository root, install dependencies and run the checks.

```bash
npm ci
npx playwright install chromium
npm run verify
```

Use Node 22 from `.nvmrc`. `npm run verify` runs lint, typecheck, unit tests, catalogue and repository guards, provenance cases, the static build, output checks, legal-inventory freshness, and desktop/mobile browser tests. The browser tests own a foreground server on port 4176 and stop it after the run. `npm run dev` starts the development site.

`npm run check` prints `check: 1 wrap, 0 violations` for the sample. `npm run build` writes `dist/`. `npm run postbuild:check` runs every output guard. Use `-- --only links`, `disclaimer`, `budget`, `launch`, or `assets` to investigate one guard.

## Compatibility and publication

[Compatibility](docs/compatibility.md) records the checked official source and distinguishes Tesla requirements from the workshop's stricter limits. [Contributing](CONTRIBUTING.md) explains metadata, source rights, and image review. [The backlog](docs/backlog.md) records the remaining release gates.

Builds default to preview indexing controls. Noindex is not access control. A protected Cloudflare preview still needs live configuration. `PUBLIC_LAUNCH=true` is rejected until Kai records legal sign-off and the approved catalogue hash. Every catalogue change must match that approved inventory. Publishing and in-car testing remain separate steps.

`npm run legal:packet` refreshes only the generated inventory. It preserves the human packet and sign-off. `npm run check:template-links` and `npm run check:upstream` perform the weekly live source checks. Normal builds use the committed hash snapshot without downloading Tesla assets.
