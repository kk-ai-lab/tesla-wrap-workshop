# tesla-wrap-workshop

## Usage

From the repository root, install dependencies and run the checks.

```bash
npm ci
npm test
npm run check
npm run build
npm run verify:gallery
npm run postbuild:check -- --only links
```

`npm test` runs the test suite. `npm run check` prints `check: 1 wrap, 0 violations` for the sample wrap. `npm run build` writes the static site into `dist/`. `npm run verify:gallery` checks the built variant pages, wrap pages, download targets, and WebP thumbnails. `npm run postbuild:check -- --only links` checks the template links and rejects Tesla file hotlinks. `npm run check:template-links` checks the 12 live template folders and runs weekly in CI.
