# Maintainer backlog

Updated on 13 November 2026. This records implementation status, not permission to publish. The [original v1 design](design/2026-11-04-v1-design.md) remains the historical plan. The [hardening design](design/2026-11-12-maintainer-hardening.md) records the takeover decisions.

## Completed local work

The input validation, gallery and preview guards, and dependency repair were reviewed and merged in [PR 23](https://github.com/kk-ai-lab/tesla-wrap-workshop/pull/23), [PR 24](https://github.com/kk-ai-lab/tesla-wrap-workshop/pull/24), and [PR 25](https://github.com/kk-ai-lab/tesla-wrap-workshop/pull/25). The CI, user-facing checks, and independent review results are recorded in [the maintenance status](reviews/2026-11-13-maintainer-status.md).

| Work | Result | Verification |
|---|---|---|
| I1-I4 catalogue, gallery, CI, template links | Existing implementation retained | Full local verification and 12 live template links |
| Corrupt PNG acceptance, issue 20 | Complete PNG chunk checks and pixel decoding at catalogue acceptance | Corruption, truncation, checksum, and valid Cybertruck cases |
| Metadata safety | Reject unsafe provenance links, impossible dates, blank titles, invalid paths, and symlink content | Catalogue tests and 4096 provenance cases |
| I5, issue 19 | Shared disclaimer, about/install page, dark/lime style, and rendered footer checks | All 15 pages, desktop/mobile browser checks |
| I6 known Tesla asset copies | Pinned hashes for all 283 upstream PNGs, reserved filenames, source/output checks | Manifest blob verification and negative tests |
| I7 brand policy | System fonts, denied font declarations, logo filenames, and reviewer checklist | Brand guard tests and rendered checks |
| I8 size budgets | HTML 50,000 bytes, aggregate JS 20,000 bytes, per-page unique thumbnails 600,000 bytes | Exact-boundary and over-budget tests |
| I9 local launch controls | Preview robots controls; public build requires signed catalogue hash | Preview/public cases and stale-approval rejection |
| I11 review packet | Human packet and separate deterministic catalogue inventory | Inventory freshness and provenance/escaping tests |
| ESLint timeout, issue 18 | Explicit 30-second fixture-test timeout | Full fixture suite |
| Preview listener PID, issue 15 | Record the actual listener after readiness, verify its working directory, and stop that process | Real local server inspection and cleanup |
| CI action runtime, issue 26 | Checkout and setup-node v7 in both workflows | PR CI and a manual template-link run on GitHub |

I7's automated checks do not recognize arbitrary SVG paths or logos embedded in raster images. No trustworthy exact Tesla T-logo path signature was added. The human image checklist remains mandatory. Exact hash matching also cannot recognize modified Tesla images.

## Remaining release gates

These gates are tracked in [issue 21](https://github.com/kk-ai-lab/tesla-wrap-workshop/issues/21).

| Gate | Next action | Owner |
|---|---|---|
| I9 protected online preview | Configure Cloudflare Pages with the reserved production branch and Access on previews; verify authentication and response headers | Kai or an authorized hosting operator |
| I10 seed artwork | Curate and review original designs for all 12 variants. The grey sample is development content | Maintainer and contributing artists |
| I10 real vehicle tests | Complete Model 3, Model Y, and Cybertruck rows, including a boundary file and actual alignment evidence | Testers with the vehicles |
| I11 legal review | Review naming, proposed domain, disclaimer, source rights, and the UV-layout derivative question | Kai and counsel |
| I12 public launch | Record human sign-off plus approved inventory SHA-256, verify all earlier gates, and authorize deployment | Kai |

No deployment, legal signature, real vehicle result, or artwork permission is inferred from the local checks. Do not close the release gates because a build passes.

## Dependency maintenance

The takeover's dependency follow-up updates Zod and Vitest to patched releases. Scoped minimatch 11 overrides under TypeScript ESLint, ESLint, and its config-array package replace an affected transitive version. [Issue 22](https://github.com/kk-ai-lab/tesla-wrap-workshop/issues/22) tracks removing each override when its upstream consumer adopts a patched release. The overrides cross upstream's declared major range, so keep the lint fixture suite and full checks as integration coverage.

The ESLint 10 migration and compatibility wrapper are documented in [the lint review](reviews/2026-11-13-eslint-migration.md) and [issue 29](https://github.com/kk-ai-lab/tesla-wrap-workshop/issues/29).

The weekly upstream check reports any Tesla revision change. Review the official README, template folders, measured dimensions, and hash inventory before accepting an update.
