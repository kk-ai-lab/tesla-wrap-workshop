# Download the sample wrap

The index lists Solid Grey and links the exact PNG a visitor downloads.

## Sub-features

- `index-lists-sample` shows `sample-solid-grey` on the index.
- `download-png` returns that PNG with content type `image/png`.

## How to get to it (user POV)

- Open `http://127.0.0.1:4173/`.
- Choose the `Solid Grey.png` link.

## Driving it with verify-site

Preconditions:

- `npm ci` and `npm run build` finished in this run.
- Preview is up at `http://127.0.0.1:4173` and this run started it.
- `content/wraps/sample-solid-grey/Solid Grey.png` is the committed file.

- **Check the built index and the response.** Run `node scripts/verify-site.mjs http://127.0.0.1:4173`. The process exits 0. Stdout names `sample-solid-grey`, the link `/wraps/sample-solid-grey/Solid%20Grey.png`, a file under `dist/wraps/sample-solid-grey/`, HTTP 200, and `image/png`.
- **Proof.** Copy that stdout to `/tmp/wrap-workshop-verify/download-sample.txt`.

## Gotchas

- The filename contains a space. The href uses `%20`. The file on disk uses a space. Decode the href before checking `dist/`.
- `astro preview` serves `dist/`. A stale `dist/` from an older build fails the byte match.
- Do not point the script at a preview this run did not start.
