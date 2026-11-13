# Maintainer hardening

The goal is a curated gallery that distributes checked Paint Shop PNGs with visible provenance. This run retains the static Astro design and the original v1 scope. User uploads, accounts, and a backend remain outside v1.

## Workflow and completion

Use high rigor at the file boundary and release controls because the product's main promise is compatible downloads. Use normal build and browser checks for the reversible style changes. Each unit ends with its relevant checks before integration continues.

1. Capture the current build and tests. Pin Tesla's current source revision and inspect its template inventory.
2. Reject corrupt PNG files at the catalogue boundary. Validate metadata links, dates, and paths before rendering or reading files.
3. Complete the shared disclaimer, about page, and style requested in issue 19.
4. Add no-rehost and brand checks, then rendered disclaimer, budget, and preview indexing checks. Run every local guard in CI.
5. Generate the legal inventory and record hardware, hosting, and legal dependencies accurately.
6. Review independently, exercise browsing and exact downloads through a real server, and publish reviewable changes.

Completion means local CI checks and browser flows pass, existing open engineering issues have a checked implementation, and every remaining release gate has a named unmet condition. It does not mean production deployment or in-car validation.

## Ownership and contracts

`WrapMeta` remains the on-disk metadata schema. `loadCatalogue(root)` is the only filesystem-to-catalogue boundary and keeps its existing success-or-violations result. Pages render its trusted `Wrap` values. The header-level synchronous `checkPng(bytes, name, variant)` remains available. Complete PNG structure and pixel decoding belong at catalogue acceptance, after the cheap byte and dimension limits. Derived dimensions and hashes still come from the same file bytes.

The new integrity checker returns a stable invalid-PNG violation rather than native decoder error text. It checks chunk lengths, checksums, image and end chunks, and complete pixel decoding through the existing Sharp dependency. No image re-encoding changes the download.

The metadata boundary requires real dates, nonblank titles and authors, and absolute HTTP(S) provenance links. Unsafe filenames and symlinks fail before file content is read. The build copies bytes only after checking that their hash still matches the accepted catalogue entry.

Repository guards own named file bytes and a pinned upstream hash manifest. `npm run check` adds repository checks to the existing catalogue check. Build-output guards also inspect `dist`. Exact hashes only cover the recorded upstream files; human image and rights review remains necessary.

`postbuild:check` defaults to all registered checks. `--only` selects one known check for debugging. The new disclaimer, budget, and launch checks share a strict HTML reader. Existing link and comment scanner interfaces remain intact. Their different parsing modes are intentional and retain their current tests.

Preview builds default to noindex and a root robots disallow. Only the exact string `true` selects public indexing. Public builds require the recorded release gates. These indexing controls do not replace Cloudflare Access. No live hosting configuration is claimed from a local build.

The maintained legal packet contains Kai's blank sign-off and an approved catalogue SHA-256. A generated companion inventory contains catalogue facts so regeneration cannot erase or invent sign-off. Public builds regenerate the current inventory in memory, require it to match the saved inventory, and compare its hash with the human-approved hash. Artwork or provenance changes invalidate that approval.

Independent review found that static footer checks cannot prove CSS visibility. Browser tests now inspect the rendered disclaimer on every generated page at desktop and mobile widths. The browser server runs in the foreground with Astro's `--ignore-lock` flag so the test runner owns shutdown.

## Architecture comparison

Two independent proposals inspected the current code. Candidate A retained the existing pure header checker and added complete validation at the catalogue boundary. Candidate B returned a new asynchronous validated PNG result and migrated the site checkers to one parsed document model.

The selected base is A. It preserves existing call signatures and keeps the native image decoder outside the pure domain checker. B contributes a shared document reader for the new post-build guards and the separate generated legal inventory. Migrating the established link and comment scanners would expand the change without closing another demonstrated defect. Full reports and the independent cross-judge are local run artifacts under `.audit/`.

Model the Domain keeps policy in the variant, licence, and metadata structures. Boundary Discipline places PNG decoding and external-input checks at catalogue acceptance. Laziness Protocol keeps the established scanner interfaces. Prove It Works requires real downloads and rendered browser checks before completion.

## Work isolation

Domain validation and site rendering use separate worktrees. The maintainer owns guard orchestration, source evidence, documentation, and integration. Inherited changes to the provenance verifier and its project skill are preserved and corrected where the stronger input policy requires it.
