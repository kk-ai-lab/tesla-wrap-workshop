# Contribute a wrap

The current gallery accepts curated changes through pull requests. Read [compatibility](docs/compatibility.md) before preparing an image.

1. Choose the exact variant in `src/domain/variants.ts` and follow its link to Tesla's template folder. Keep downloaded Tesla assets outside this checkout.
2. Create original work or use documented CC0 or public-domain source material. Do not include Tesla templates, examples, vehicle images, third-party logos, or copyrighted characters.
3. Create `content/wraps/<id>/meta.json` and add the PNG in that folder. Use a new lowercase slug as the ID. Replacing an image needs a new ID so existing download hashes stay meaningful.
4. Copy the sample metadata shape. Set the exact variant, original filename, title, tags, real added date, and either `CC0-1.0` or `CC-BY-4.0` as the output licence.
5. For original work, add `kind: "own"` and a nonblank author. Record a creation tool when useful. For each third-party source, add `kind: "third-party"`, its author, absolute HTTP(S) source and licence-evidence URLs, and the real retrieval date. Third-party source entries are allowed only with CC0 output under the current project policy. A URL alone does not prove a source's licence.
6. Use Node 22. Run `npm ci`, `npm run legal:packet`, and `npm run verify`.
7. Open a pull request. Provide a screenshot of the affected pages and evidence of the source licence. Complete the image and rights review checklist.

The validator preserves PNG bytes. It does not repair or recompress a file. Fix invalid files in your image editor and rerun the checks.

The no-rehost manifest covers exact upstream image hashes at a recorded Tesla commit and reserved template filenames. Brand lint checks bundled fonts, denied font declarations, and suspicious logo filenames. These checks cannot recognize every altered image or SVG logo. Review the rendered image before accepting it.

## Refresh Tesla source evidence

Run `npm run hash:tesla -- <upstream-commit>` and save stdout to a temporary file. The updater downloads images into memory, verifies their Git blob hashes, and emits only hashes and dimensions. Inspect the inventory and template dimensions before replacing `guards/tesla-assets.json`. Update `docs/compatibility.md` and the variant registry if the official requirements changed.

Run the full local verification after a source update. The weekly network check reports an upstream revision change for maintainer review; it does not silently accept a new specification.
