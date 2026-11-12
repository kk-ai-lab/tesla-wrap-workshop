# Maintainer takeover verification

The goal is a curated Tesla Paint Shop PNG gallery with checked downloads and clear provenance. This run prepares the remaining local v1 work and records the hardware, artwork, legal, and hosting gates without inventing completion.

## Sources and design

Tesla's official source was checked at revision `86c7d31454caf0f20af6f6af105f577643f13bce`. All 283 PNG blobs were fetched into memory, verified against their Git blob IDs, hashed, and measured. Only hashes and dimensions are committed. The 12 templates match the registry. All 12 live folder links returned HTTP 200. The README supplies no distinct image-content policy and the checked tree has no licence file. [Compatibility](../compatibility.md) separates these observations from project policy.

Two independent architecture proposals compared incremental boundary validation with a larger asynchronous PNG API and shared site-checker migration. The cross-judge selected the incremental design. The implementation keeps existing checker signatures and adds a shared reader for the new page policies. [The design](../design/2026-11-12-maintainer-hardening.md) records the contracts.

## Verified local behavior

Node 22.23.4 was used for installation and verification. A clean `npm ci` succeeds. The completed `npm run verify` passes 142 unit tests, 4096 provenance cases, the catalogue and source guards, the 15-page build, the comment scanner, gallery/download checks, all output policies, legal-inventory freshness, and four Playwright browser tests.

Chromium tests cover 1440x1000 desktop and 390x844 mobile layouts. Every generated page has readable content and a visible full disclaimer without horizontal overflow. Tests navigate from the gallery to Model 3, open the sample detail, read its provenance, verify the downloaded PNG's content type and exact source bytes, and follow the installation link. The application produces no console errors in those checks. Browser plugin was unavailable; the installed Playwright tools and a committed Playwright runner were used.

The largest generated HTML page in this catalogue is the about page at 5316 bytes. The build emits zero JavaScript bytes. Those figures describe the current one-sample build; byte budgets also have exact-boundary and over-budget tests.

## Independent review and corrections

The first correctness review by gpt-6.1-terra reproduced stale legal approval and a stylesheet-hidden disclaimer passing static checks. The public build now compares current regenerated inventory, saved inventory, and the SHA-256 approved in the human packet. Browser tests check actual rendered visibility. A mutation that hides the footer fails with `Expected: visible` and `Received: hidden` on both viewports. The restored build passes.

The final correctness review by gpt-6-astra reproduced a browser locator failure when a model gained a second design. The sample action now selects its exact detail URL. A temporary second valid Model 3 design passed the build and all four browser tests. The temporary artwork was removed and the original catalogue was rebuilt and verified. The reviewer independently confirmed the corrected locator and returned PASS with no remaining actionable findings in scope.

Two comment and suppression reviews by gpt-6.1-terra found no added comments, suppressions, or required deletions. The established lint fixture exceptions were excluded from that review.

An actual `PUBLIC_LAUNCH=true npm run build` against the unsigned packet fails with `public build blocked`. Unit checks also reject stale saved inventory and current-catalogue changes after approval. No real sign-off was written.

## Remaining limits

[The backlog](../backlog.md) and [release issue 21](https://github.com/kk-ai-lab/tesla-wrap-workshop/issues/21) retain seed artwork, three real vehicle checks, protected Cloudflare preview, counsel review, and Kai's production release. Exact hashes and font/logo-name checks do not prove image originality or detect every embedded logo. The sample is development content.

The dependency update has its own [review](2026-11-12-dependencies.md). The scoped minimatch override has a tracked removal task in [issue 22](https://github.com/kk-ai-lab/tesla-wrap-workshop/issues/22). Clean installation and audit reported zero findings after that update.

Local verification and independent review do not establish a remote GitHub Actions result, branch protection, production configuration, or a deployed site.
