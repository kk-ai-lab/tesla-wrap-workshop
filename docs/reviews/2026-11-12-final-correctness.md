# Final correctness review

The goal is a curated Tesla Paint Shop PNG gallery that another maintainer can extend safely. Reviewed tracked and untracked application, guard, and browser-test changes against `943b3f6`. No application files changed during this review.

Verdict: ISSUES. One reproducible P2 finding remains.

## P2. Browser navigation test fails when Model 3 gains a second design

`e2e/gallery.spec.ts:44` clicks `getByRole("link", { name: "View details", exact: true })` without selecting a card. `src/site/components/WrapCard.astro:29` emits that link once per wrap. A normal second valid Model 3 design therefore gives the locator two matches, making both desktop and mobile CI fail with a Playwright strict-mode error even though browsing works.

Reproduced with Chromium against the built `dist/models/model3/index.html`, cloning its existing rendered card and changing the clone's detail links to `/wraps/second-valid-design/`. The locator count was 2 and the unchanged click raised `strict mode violation`. This probe changed only the temporary browser DOM. Scope the click to the expected sample card or its exact detail href, retaining the navigation assertion.

## Verified fixes and boundaries

The public build now regenerates inventory from validated current catalogue content, compares it to the saved inventory, and compares its SHA-256 to the human-approved hash. Both stale inventory and changed catalogue scenarios reject. The previously identified stylesheet-hidden disclaimer is now covered by desktop/mobile rendered visibility checks in CI. PNG acceptance validates chunk CRCs, required structure and complete decoding, and rejects truncation, appended bytes, corrupt compressed pixels and symlink content in the reviewed cases.

Ran `npx vitest run test/page-policy.test.ts test/legal-packet.test.ts test/load.test.ts test/repository-guards.test.ts`. All 43 tests passed. Inspected source/output repository guards, build copying and byte checks, metadata constraints, page policies and CI ordering. No other actionable regression was established in this focused pass. The parent separately reported full verification and clean installation; this pass did not rerun them.

Human artwork review, actual vehicle tests, legal sign-off, protected live hosting and deployment authorization remain deliberately open gates. This report does not satisfy them.

## Follow-up verification

Current verdict: PASS. The sole P2 finding above is resolved in `e2e/gallery.spec.ts:44`. The detail-link locator now intersects its accessible name with the exact sample href. Independently reran the rendered two-card Chromium probe. There were 2 detail links, exactly 1 scoped sample link, and the scoped click actionability check passed.

Also inspected `/tmp/tesla-wrap-growth-probe.txt`. It records a successful build with the additional `/wraps/maintainer-growth-probe/` route and all 4 desktop/mobile browser tests passing. This confirms the ordinary second-design workflow beyond the isolated DOM probe. No further application changes were made by this reviewer. The earlier focused review scope and open human/live-environment gates still apply.
