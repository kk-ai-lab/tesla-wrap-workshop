# Local template-composite artwork candidates

These twelve candidates use OpenAI imagegen textures and official Tesla templates from commit `86c7d31454caf0f20af6f6af105f577643f13bce`. They replace earlier approximate candidates under the same IDs. Solid Grey is unchanged. They remain local review candidates, with no in-car test, Tesla acceptance or legal approval.

[The processing record](candidate-artwork-sources.json) records source and template SHA-256, source dimensions, output SHA-256, output bytes, processing choices and pixel counts. The twelve downloaded template files were compared by SHA-256 with `https://raw.githubusercontent.com/teslamotors/custom-wraps/86c7d31454caf0f20af6f6af105f577643f13bce/<variant>/template.png` on 2026-11-13. All matched. Downloaded source templates are kept outside this worktree and are not added as standalone assets.

## Pixel policy and limitations

The local mask includes only template pixels whose decoded RGBA values are exactly `(255,255,255,255)`. Every other pixel is retained byte for byte in decoded RGBA, including grey lines, antialiased boundaries, black regions and all partially or fully transparent pixels. There is no threshold, dilation, erosion or alpha flattening. Model X has transparent background, opaque white islands, black thin lines and antialiasing; its background must not be described as opaque white. The conservative policy leaves original grey edge pixels visible and may create pale fringes. It is a project processing policy, not an asserted Tesla documentation requirement.

The source texture is auto-oriented and resized across the full template canvas with Lanczos3. This establishes mask placement only. It does not establish coherent panel artwork, seam continuity, visual quality or correct real-car mapping. Every paintable pixel receives sampled texture RGB. A sampled pure-white pixel has its blue channel set to 254 so no eligible pixel remains identical to the blank white template. This minimal change is recorded per candidate. Alpha always comes from the template.

To meet 1,000,000 bytes, the script first tries unquantized texture, then quantizes only the texture to 256, 128, 64, 32 or 16 colours without dithering as needed. The final composite is lossless truecolour RGBA PNG and is never globally quantized. This preserves template pixels exactly while allowing texture colour reduction. The record states the selected setting. Cybertruck is 1024x768; the remaining eleven are 1024x1024.

Every saved PNG is decoded and checked pixel by pixel. Every protected RGBA pixel and every alpha value must match the template exactly. All opaque pure-white pixels must be filled. All twelve outputs passed with zero protected-pixel or alpha mismatches. Matching this mask does not imply official approval or suitability for a car.

## Reproduce preparation

Use Node 22 with installed dependencies from the repository root.

```sh
node scripts/prepare-imagegen-candidates.mjs /absolute/path/to/ordered-sources.json /absolute/path/to/templates 86c7d31454caf0f20af6f6af105f577643f13bce /absolute/path/to/new-review-output
```

The source array order is copper-circuit, tidal-jade, porcelain-grid, ember-chevron, pine-canopy, dune-rhythm, midnight-weave, cobalt-pulse, olive-orbit, plum-lattice, silver-prism and ochre-arches. Templates are named `<variant>.png`. The original textures have a verified local archive at `.audit/imagegen-originals/texture-01.png` through `texture-12.png`, in the same order; `.audit/imagegen-originals/sources.json` lists those paths. This archive is local and is not part of a Git checkout. Resolve relative source entries against the working directory when rerunning. The caller must independently obtain and verify the fixed-commit templates; the script records their hashes and the supplied commit but does not authenticate the download itself.

The output directory must be new, outside the repository, with an existing parent. The script refuses an existing directory, reserves the output with exclusive `mkdir` and creates all files exclusively. It writes review PNGs, proposed metadata and the processing record only into this new directory. It does not import files, overwrite catalogue assets or make imagegen requests. Inspect failed partial output and choose another new directory for retry. Importing approved replacements into the local candidate worktree is a separate operator step. Human-created catalogue assets are outside this preparation workflow.

## Outstanding review

These composites contain retained Tesla template pixels. Permission for template use and derivative works remains outstanding. Generation and processing do not establish rights in templates or artwork. The `CC0-1.0` metadata expresses only a proposed licence for any project-owned contributions, subject to human rights and authorization review. It does not grant rights in Tesla content or assert copyright protection for AI output. All twelve keep their `candidate` tags. Template layout, panel rendering, legal clearance and in-car behavior still need human review. Nothing has been uploaded to Tesla or published by this task.

Run `npm run legal:packet` to refresh [the inventory](legal-catalogue.md). Human sign-off remains in [the legal packet](legal-review.md). Schema and pixel checks are not legal clearance.
