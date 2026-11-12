---
name: verify-wrap-workshop
description: Prove the tesla-wrap-workshop static site lists the sample wrap and serves its PNG, that every variant and wrap page exists with a WebP thumbnail, that every variant page links to Tesla's template folder and no page hotlinks a Tesla file, that the spec-check CLI reports one wrap and zero violations, and that the built dist has no HTML, CSS, or JS comments. Use after changing the catalogue, a page, the checker, the link guard, the dist comment scan, or the thumbnail build.
---

# Verify tesla-wrap-workshop

The site is a static Astro build. A visitor opens the index and downloads `Solid Grey.png`. The checker is `npm run check`. Start one preview per run. Do not drive a preview you did not start.

## Launch

From the repository root, install, build, and start the preview. `content/wraps/sample-solid-grey/` is the seed wrap. There is no database and no migration.

```bash
mkdir -p /tmp/wrap-workshop-verify
npm ci
npm run verify
node ./node_modules/astro/bin/astro.mjs preview --host 127.0.0.1 --port 4173
```

Ready when the preview log prints `http://127.0.0.1:4173`. Astro 7 can detach a child and exit even when invoked directly. Record the actual listener after readiness. The shell parent PID is not reliable.

```bash
preview_pid="$(lsof -nP -iTCP:4173 -sTCP:LISTEN -t)"
case "$preview_pid" in ''|*[!0-9]*) exit 1 ;; esac
ps -p "$preview_pid" -o command=
lsof -a -p "$preview_pid" -d cwd -Fn
printf '%s\n' "$preview_pid" > /tmp/wrap-workshop-verify/preview.pid
```

The process command must be this run's Astro preview and its working directory must be this checkout. If port 4173 was already occupied before launch, choose a free port for this run and use it consistently. Do not adopt an existing listener.

## Doctor

Run this before driving the site. Stop if any line fails.

```bash
curl -sI http://127.0.0.1:4173/ | head -n 1
test -f /tmp/wrap-workshop-verify/preview.pid
test "$(lsof -nP -iTCP:4173 -sTCP:LISTEN -t)" = "$(cat /tmp/wrap-workshop-verify/preview.pid)"
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

The link guard also does not need the preview. Run it after the build:

```bash
npm run postbuild:check -- --only links
```

The exit code is 0. Stdout is `links: 12 template links ok, 0 tesla hotlinks`. It fails when a variant page has a missing, wrong, or duplicate template link, when a template-marked link leaves the Tesla repo, or when an `<a>` href, an `<img>` src or srcset, or a `<source>` srcset points at `raw.githubusercontent.com/teslamotors`. Hotlinks inside `<noscript>` count, and an inert `<template>` marker does not.

Run `npm run postbuild:check` without a subset before accepting the change. It checks links, the visible footer disclaimer, byte budgets, launch indexing controls, and build-output assets. Open `/`, `/models/model3/`, `/wraps/sample-solid-grey/`, and `/about/` on desktop and mobile. Follow the vehicle and wrap links, read the disclaimer, and confirm the installation instructions render. Capture screenshots and relevant console errors. These checks do not establish in-car acceptance or private Cloudflare Access.

## Evidence

Copy the verify-site stdout to `/tmp/wrap-workshop-verify/download-sample.txt`. Copy the checker stdout and exit code to `/tmp/wrap-workshop-verify/check-cli.txt`. Copy the dist comment scan stdout and exit code to `/tmp/wrap-workshop-verify/check-dist.txt`. Copy the gallery check stdout and exit code to `/tmp/wrap-workshop-verify/verify-gallery.txt`. Copy the link guard stdout and exit code to `/tmp/wrap-workshop-verify/check-links.txt`. Those files are the proof. Cleanup does not delete them.

## Cleanup

Before stopping, compare the stored PID with the actual listener again and check its command and working directory. If they differ, investigate rather than killing the stored PID. Kill only this run's verified listener. Confirm that the PID has exited and port 4173 refuses connections, then remove the PID file. Leave the proof text files.

## Helpers

`node scripts/verify-site.mjs [baseUrl]`

Omit `baseUrl` to check `dist/` only. Pass the preview origin to fetch the download link as well.
