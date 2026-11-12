# Candidate B: validated catalogue and a shared built-site document model

The goal is to complete the local curated-gallery backlog while preserving Kai's legal and production release gates. This is a read-only architecture proposal. No application source, issue, deployment, or existing change was modified.

Base HEAD: `943b3f679613853f3cf4f1590fbf2a491d0a1039`. Examined on 2026-11-12. Initial worktree changes were `package.json`, `.agents/`, `.audit/`, and `scripts/verify-provenance.ts`. Another agent changed `test/comment-ban.test.ts` during this investigation. Those files were left untouched. This report is the only file written by this investigator.

## What the current system does

`src/domain/variants.ts` owns the twelve supported variants, their preferred dimensions, and Tesla folder URLs. `src/domain/licences.ts` permits own designs under CC0-1.0 or CC-BY-4.0 and third-party provenance under CC0-1.0. `src/domain/wrap.ts` owns the metadata schema, provenance compatibility, and `Wrap` and `Catalogue` types.

`src/catalogue/load.ts:12` is the filesystem boundary. It discovers non-hidden wrap folders, parses each `meta.json`, checks identity and provenance, reads the selected file, checks PNG headers, hashes bytes, detects duplicate hashes, and builds the variant map. It returns no catalogue when any violation exists. `src/cli/check.ts` formats those violations and sets the exit status.

The index and both dynamic route files call `loadCatalogue` during Astro's build. Pages render validated metadata and derive download paths. `src/site/layouts/Base.astro` wraps every current page. `astro.config.mjs` loads the catalogue again after HTML generation, copies original PNG bytes into `dist/wraps`, and asks Sharp to create 512-pixel-wide WebP thumbnails. Repeated catalogue loads are simple and acceptable at this scale. A persistent cache or build service is unnecessary.

`scripts/verify-gallery.ts` separately reads HTML using regular expressions, checks index and variant navigation, verifies download attributes and exact download bytes, and inspects thumbnail metadata. `scripts/check-links.ts` already uses parse5, loads all HTML, and validates template links and raw GitHub hotlinks. `scripts/postbuild-check.ts` currently supports only `--only links`. `scripts/check-dist.ts` has a separate HTML, CSS, and JavaScript parser pipeline for the repository's comment ban. CI calls each command explicitly and ends with only the links subset of post-build checks.

## Sources and actual gaps

Tesla's [official custom-wraps README](https://github.com/teslamotors/custom-wraps) was read live. It says to use PNG, stay within its published size and resolution limits, and use restricted filenames. The repository's 1,000,000-byte limit, extension-inclusive 30-character limit, and exact template dimensions are conservative project choices. Do not describe those choices as more precise Tesla guarantees. The README now describes both mobile-app and USB installation. It does not establish a right to redistribute Tesla assets.

The [PNG specification](https://www.w3.org/TR/png-3/) describes chunk structure, CRCs, required header and end chunks, and image data. A valid signature plus two dimension integers does not establish a valid PNG. The following findings were reproduced with inline Node scripts that imported existing modules and created mutations only in memory.

| Finding | Evidence | Classification |
|---|---|---|
| Header-only and corrupt PNGs pass the domain checker. | `src/domain/spec.ts:47` checks only 24 bytes, magic, and the IHDR tag. `checkPng(valid.slice(0,24), "valid.png", "model3")` returns `[]`. Flipping byte 29 in the IHDR CRC also returns `[]`. | Actual correctness bug in the advertised file validation. |
| No end-of-file integrity check exists. | Removing the final IEND chunk or adding trailing bytes returns `[]`. Sharp full raw decode also accepts both mutations. | Actual integrity gap. A Sharp-only replacement does not fully close it. |
| Invalid provenance URLs become rendered links. | `src/domain/wrap.ts:29` accepts strings. A third-party entry with `sourceUrl: "javascript:alert(1)"` and `sourceLicenceUrl: "not a url"` passes both schema and provenance checks. The detail page puts these values in `href`. | Actual boundary validation defect. Fix before adding content. |
| Impossible dates and blank titles pass. | `title: " "`, `addedOn: "2026-99-99"`, and the same retrieval date pass current validation. | Actual metadata-quality defects. |
| The file path is read before its filename is checked. | `src/catalogue/load.ts:62` reads `meta.file`, while its name is checked at line 67. | Boundary hardening gap. Existing bad-name checks stop publication, but do not stop the attempted read. Validate the basename first. |
| Disclaimer and preview indexing controls are absent. | `src/site/layouts/Base.astro:11` has no robots metadata. Its footer at line 27 has no disclaimer. No about or robots route exists. | Unimplemented I5 and local I9 acceptance, not a regression. |
| No-rehost, brand, and budget enforcement is absent. | No tracked `guards/` inventory exists. Current `npm run check` only calls `loadCatalogue`. The post-build command accepts links only. | Unimplemented I6-I8 acceptance. |
| CI can remain green after a future guard is added but omitted from its command. | `.github/workflows/ci.yml` explicitly runs `postbuild:check -- --only links`. | Integration gap to fix in the same unit that adds the first new check. |
| Legal packet and in-car records are absent. | The design requires them in I10-I11, but they are not present in `docs/`. | Remaining backlog. Automated file checks cannot manufacture in-car or legal evidence. |

The current sample itself was not found corrupt. The defects concern accepted inputs. No claim is made that the catalogue has malicious content or that Tesla compatibility has been established in a vehicle.

## Central validated PNG result

Use one domain entry point that returns derived dimensions only after validation succeeds. Keep filename policy, byte limits, dimension policy, and integrity reporting in `src/domain/spec.ts`. Retire the exported unchecked `readIhdr` when its callers migrate.

```ts
type PngInfo = Readonly<{ width: number; height: number; bytes: number }>;
type PngResult =
	| { ok: true; image: PngInfo }
	| { ok: false; violations: PngViolation[] };

function parseWrapPng(
	bytes: Uint8Array,
	name: string,
	variant: VariantId,
): Promise<PngResult>;
```

The function first checks size and filename, then walks bounded PNG chunks. It validates lengths, IHDR placement and shape, chunk CRCs, required image data and IEND, and the file boundary. It rejects unsupported critical chunks. It then uses the existing Sharp dependency to decode the pixels, with the input-pixel limit set to the supported maximum. The module accepts bytes and has no filesystem or Astro dependency. Do not write a custom PNG decompressor, scanline decoder, color converter, or Adam7 implementation.

The structural pass prevents the demonstrated IEND and trailing-data acceptance. Full decoding rejects corrupt compressed image data that a chunk check alone cannot establish as valid pixels. Decide and document treatment of animated PNG explicitly if encountered. Do not claim Tesla bans animation based on the README's silence. Rejecting it as a conservative catalogue policy is a separate decision.

`loadCatalogue` awaits this result and spreads `image` into `Wrap`. It calculates SHA-256 itself because hashing and duplicate detection are catalogue concerns. Tests and CLI callers migrate to the new result together. An asynchronous function is appropriate because catalogue loading is already asynchronous. The cost is a Node and Sharp dependency in domain validation and repeated decode work in existing build calls. That cost is preferable to maintaining a second PNG decoder. Measure before adding a cache.

```ts
const image = await parseWrapPng(fileBytes, meta.file, meta.variant);
if (!image.ok) {
	violations.push(...image.violations.map((item) => ({ ...item, wrap: folder })));
	continue;
}
candidates.push({ ...meta, ...image.image, sha256 });
```

Strengthen `wrapMetaSchema` at the same external-data boundary. Third-party provenance should have required, trimmed author and HTTP(S) source URLs, plus real calendar dates. Keep licence compatibility in `checkProvenance`; remove its now-redundant optional-field completeness logic. A validated filename schema prevents traversal syntax before any read. Reject symlinks for catalogue files, or resolve and check containment if symlinks are an intentional supported feature. The simpler catalogue policy is to require ordinary committed files.

## One built-site model for content checks

Extract the file enumeration, HTML parsing, element traversal, and attribute access already in `scripts/check-links.ts` into `scripts/built-site.ts`. Load each HTML document once for links, disclaimers, budgets, launch controls, and gallery semantics. Keep policy in small functions, not a plugin registry or class hierarchy.

```ts
type SiteFile = Readonly<{ path: string; bytes: Uint8Array; size: number }>;
type HtmlPage = Readonly<{
	path: string;
	size: number;
	document: DefaultTreeAdapterMap["document"];
}>;
type BuiltSite = Readonly<{
	files: ReadonlyMap<string, SiteFile>;
	pages: ReadonlyMap<string, HtmlPage>;
}>;
type SiteReadResult =
	| { ok: true; site: BuiltSite }
	| { ok: false; findings: SiteReadFinding[] };

function readBuiltSite(root: string): SiteReadResult;
function checkLinks(site: BuiltSite): LinkCheckResult;
function checkDisclaimer(site: BuiltSite): DisclaimerFinding[];
function checkBudget(site: BuiltSite): BudgetFinding[];
function checkLaunch(site: BuiltSite, mode: LaunchMode): LaunchFinding[];
```

Use normalized relative file paths as map keys. Resolve asset URLs against the page path and HTML base URL. Reject missing local targets, path escapes, unsupported encoded separators, and remote thumbnail dependencies. A parser error fails the document load; a directory with zero HTML pages also fails. Keep findings deterministic and attached to a file and rule. No generic policy configuration DSL is needed.

The shared model uses the current link checker's no-script parse mode so `<noscript>` contents remain inspectable. Disclaimer checking excludes inert and hidden descendants, including `template`, `script`, `style`, and `noscript`. It requires the actual approved sentence in the marked footer element, not a string elsewhere in the file. Static DOM validation cannot prove all CSS visibility, so a browser check verifies the footer at mobile and desktop widths.

Keep `scripts/check-dist.ts` separate initially. It deliberately parses with scripting enabled and uses its own handling for noscript, inline scripts, event handlers, and CSS. Mechanically replacing its tree with the link checker's no-script tree risks regressing the existing comment-ban coverage. Consolidating its parser is future work unless a concrete bug requires it.

Migrate `verify-gallery.ts` from regex extraction to the shared document model in the same unit as this extraction. Preserve exact-byte download checks and thumbnail decode checks. A new `checkGallery(site, catalogue)` checks navigation and download semantics, while its CLI retains filesystem comparisons against catalogue originals. This removes three overlapping HTML interpretations without replacing the specialized comment scanner.

The post-build CLI owns orchestration. No flag means all local checks. `--only` supports explicit known names for development and exits with code 2 for unknown names. It loads the site once and prints rule-specific summaries. CI always runs the complete command. It does not rely on developers remembering a new CI step for every guard.

## Guard ownership and launch state

No-rehost and brand checks share a filesystem inventory, not the HTML DOM. Add `src/guards/no-rehost.ts` and `src/guards/brand.ts` as pure functions over named bytes. The CLI collects tracked repository files and relevant untracked local files while respecting `.gitignore`; the build checker also scans public output. The local workflow should reject an accidental `content/x.png` before it is staged. Do not scan `node_modules`, `.git`, audit artifacts, or ordinary prose for bare mentions of Tesla.

The Tesla hash snapshot records an upstream commit, capture date, source paths, and SHA-256 values. A separate explicit refresh script reads upstream blobs into memory and writes hashes only. It verifies complete coverage of asset paths at the pinned commit and fails on incomplete fetches. CI consumes the pinned snapshot without live network access. Reject exact hashes and prohibited template filenames. Explain that modified assets evade exact matching. Do not market this check as copyright detection.

Brand lint has narrow signals: denied font names in font declarations, forbidden font files outside a documented allowlist, recognizable logo asset filenames, and any independently sourced exact SVG signature. Keep those rules in `guards/brand-denylist.json`. If no trustworthy logo signature exists, document that limitation instead of inventing one. The PR template carries the human logo and character review. Denying all uses of the word Tesla would conflict with the approved product name and disclaimer.

Budgets live in one small constant: HTML bytes per file, all emitted JavaScript bytes, and the total unique thumbnail asset bytes referenced by each page. Specify decimal byte limits consistently. Resolve `img`, `source`, and `srcset` candidates conservatively and count each unique local file once per page. Do not count the full-size PNG behind a download anchor as a thumbnail. Add missing assets and unsupported references as failures so a broken URL cannot lower the budget.

```ts
type LaunchMode = "preview" | "public";
function launchMode(value: string | undefined): LaunchMode;
```

Only the exact string `true` means public. Unset means preview; unexpected values fail with a useful configuration error. `Base.astro` and a `robots.txt` route use the same mode parser as the post-build check. Preview output requires robots metadata with both `noindex` and `nofollow`, plus a root disallow rule. Public output must not contain those indexing blocks. Local public-mode output is a test artifact, not legal approval or deployment authority. Cloudflare Access, production branch settings, and live headers require separate deployment evidence under I9. Noindex is not access control.

## I10-I11 records without invented approval

Add the contributor instructions and an in-car test record with explicit untested rows. A generated local fixture proves dimensions and file validity, not correct UV mapping or vehicle compatibility. Own designs for all twelve variants need genuine artwork review. Keep the remaining hardware tests as open gates rather than marking I10 complete on a row count.

`scripts/legal-packet.ts` calls `loadCatalogue` and renders a stable inventory with each wrap's licence, author, source URLs, file hash, and added date. The packet also records the approved name, actual chosen domain or an unset value, exact disclaimer, upstream source revision, and unresolved UV-template derivative question. It records the actual preview URL only after one exists.

The generated inventory must not overwrite human sign-off. The smallest safe arrangement is a generated companion `docs/legal-catalogue.md` linked by a maintained `docs/legal-review.md`, where `LEGAL_SIGNOFF:` remains blank. Alternatively, replace only a clearly delimited inventory section and refuse to alter signed packets. Do not infer approval from a non-empty string written by automation. The design explicitly reserves the signed commit and release action for Kai.

## Atomic delivery units and evidence

1. Fix metadata validation and parse PNG bytes into one validated result. Add acceptance tests for header-only data, CRC and chunk errors, malformed compressed data, impossible dates, unsafe URLs, and pre-read filename rejection. Preserve valid palette, alpha, and interlaced PNG support with real image fixtures. Run domain, catalogue, and CLI tests, then the normal catalogue check and build.
2. Extract the built-site reader and migrate links and gallery checks together. Preserve all link tests, add real HTML attribute variants, and verify exact downloads after a build. Leave the comment checker unchanged.
3. Add the disclaimer component and about page with rendered checking. Wire default all-checks invocation into CI now. Verify every emitted page and inspect the visible footer in a browser.
4. Add no-rehost and brand guards, pinned evidence, and the PR checklist. Test exact-match and renamed-asset failures with synthetic hashes. Verify that the approved name and disclaimer remain allowed.
5. Add byte budgets and default-preview robots output. Test at the limit and one byte over, missing thumbnails, all pages, malformed flag values, and both launch modes. Verify output through a local server. Do not create or deploy a production branch.
6. Add the generated legal inventory, maintained legal packet, contributor instructions, and untested in-car records. Verify deterministic regeneration and that no command changes `LEGAL_SIGNOFF`. Keep seed-artwork, hardware, hosting, and legal gates explicit.

Candidate B costs more signature migration than patching `checkPng` and adding independent scanners. It reduces duplicated parsing and prevents callers from reading dimensions from unvalidated bytes. Its smallest coherent scope is the PNG result and shared content-check DOM. A universal artifact framework, cross-build cache, image fingerprint matching, custom PNG decoder, and full browser layout engine do not earn their maintenance cost here.

Model the Domain shaped the validated PNG result and the shared document model. Laziness Protocol kept the comment scanner separate and avoided a generic guard framework. Both principle files were read for this proposal.

Checks performed were repository and source inspection, the official Tesla README fetch, the PNG specification fetch, and in-memory Node probes of existing validation and Sharp behavior. No build or full test suite was run by this investigator, because the parent owns baseline verification and parallel agents share the checkout. The Cybertruck folder page fetch failed, so this report does not claim a newly measured template dimension.
