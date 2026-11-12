---
name: verify-wrap-workshop
description: Prove the tesla-wrap-workshop static site lists the sample wrap and serves its PNG, that every variant and wrap page exists with a WebP thumbnail, that the spec-check CLI reports one wrap and zero violations, and that the built dist has no HTML, CSS, or JS comments. Use after changing the catalogue, a page, the checker, the dist comment scan, or the thumbnail build.
---

# Verify tesla-wrap-workshop

The site is a static Astro build. A visitor opens the index and downloads `Solid Grey.png`. The checker is `npm run check`. Start one preview per run. Do not drive a preview you did not start.

## Launch

From the repository root, install, build, and start the preview. `content/wraps/sample-solid-grey/` is the seed wrap. There is no database and no migration.

```bash
mkdir -p /tmp/wrap-workshop-verify
npm ci
npm run build
npm run check:dist
npm run verify:gallery
node ./node_modules/astro/bin/astro.mjs preview --host 127.0.0.1 --port 4173
```

Ready when the preview log prints `http://127.0.0.1:4173`. Write the node process id to `/tmp/wrap-workshop-verify/preview.pid`. Start the command directly so that pid is the listener. `npx astro preview` leaves a child listening after the npm parent exits.

## Doctor

Run this before driving the site. Stop if any line fails.

```bash
curl -sI http://127.0.0.1:4173/ | head -n 1
test -f /tmp/wrap-workshop-verify/preview.pid
node -v
```

The status line contains `200`. `node -v` starts with `v22.`. The listener on port 4173 is the process in the pid file.

## Drive

With the preview up, from the repository root:

```bash
node scripts/verify-site.mjs http://127.0.0.1:4173
```

The script exits 0 only when `dist/index.html` contains `sample-solid-grey`, its PNG link resolves to a file under `dist/`, and `GET` of that link returns 200 with a content type containing `image/png` and the same bytes as that file.

The checker does not need the preview:

```bash
npm run check
```

The exit code is 0. Stdout includes the line `check: 1 wrap, 0 violations`.

The dist comment scan also does not need the preview. Run it after the build, before or after the checker:

```bash
npm run check:dist
```

The exit code is 0. The scanner prints nothing.

The gallery check also does not need the preview. Run it after the build:

```bash
npm run verify:gallery
```

The exit code is 0. Stdout includes `verify-gallery: 12 variant pages, 1 wrap page, 1 thumbnail, 12 index links ok`. It fails when a variant page, a wrap page, a download target, a WebP thumbnail, or an index variant link is missing.

## Evidence

Copy the verify-site stdout to `/tmp/wrap-workshop-verify/download-sample.txt`. Copy the checker stdout and exit code to `/tmp/wrap-workshop-verify/check-cli.txt`. Copy the dist comment scan stdout and exit code to `/tmp/wrap-workshop-verify/check-dist.txt`. Copy the gallery check stdout and exit code to `/tmp/wrap-workshop-verify/verify-gallery.txt`. Those files are the proof. Cleanup does not delete them.

## Cleanup

Kill the pid stored in `/tmp/wrap-workshop-verify/preview.pid`. That pid is the node process started above. Do not kill by process name. Delete the pid file after the process is gone and port 4173 refuses connections. Leave the proof text files.

## Helpers

`node scripts/verify-site.mjs [baseUrl]`

Omit `baseUrl` to check `dist/` only. Pass the preview origin to fetch the download link as well.
