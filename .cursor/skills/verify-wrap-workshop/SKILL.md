---
name: verify-wrap-workshop
description: Prove the tesla-wrap-workshop static site lists the sample wrap and serves its PNG, and that the spec-check CLI reports one wrap and zero violations. Use after changing the catalogue, the index page, or the checker.
---

# Verify tesla-wrap-workshop

The site is a static Astro build. A visitor opens the index and downloads `Solid Grey.png`. The checker is `npm run check`. Start one preview per run. Do not drive a preview you did not start.

## Launch

From the repository root, install, build, and start the preview. `content/wraps/sample-solid-grey/` is the seed wrap. There is no database and no migration.

```bash
mkdir -p /tmp/wrap-workshop-verify
npm ci
npm run build
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

## Evidence

Copy the verify-site stdout to `/tmp/wrap-workshop-verify/download-sample.txt`. Copy the checker stdout and exit code to `/tmp/wrap-workshop-verify/check-cli.txt`. Those files are the proof. Cleanup does not delete them.

## Cleanup

Kill the pid stored in `/tmp/wrap-workshop-verify/preview.pid`. That pid is the node process started above. Do not kill by process name. Delete the pid file after the process is gone and port 4173 refuses connections. Leave the proof text files.

## Helpers

`node scripts/verify-site.mjs [baseUrl]`

Omit `baseUrl` to check `dist/` only. Pass the preview origin to fetch the download link as well.
