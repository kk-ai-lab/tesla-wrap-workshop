# Correctness and security review

Scope: current tracked and untracked changes against `943b3f6`, focused on the catalogue and publication guards. No application changes were made. Findings concern guard guarantees; the current blank legal sign-off still blocks public builds, and the current disclaimer was not found to be hidden.

## Findings

1. **P2 — A prior legal sign-off remains valid after the proposed catalogue changes.** `scripts/release-gate.ts:7` checks only that a nonempty `LEGAL_SIGNOFF` line exists. Neither the gate nor `legal:check` associates that sign-off with the reviewed catalogue or inventory. Once Kai signs off, adding a valid design and regenerating `docs/legal-catalogue.md` makes the inventory check pass while the public build still accepts the old sign-off. This conflicts with `docs/legal-review.md`'s requirement to review every proposed design and its rights record. A temporary-root probe confirmed that `assertReleaseAllowed(root, "true")` accepts `LEGAL_SIGNOFF: Kai, approved prior catalogue` even when no inventory or catalogue exists there. Bind the approval to the reviewed inventory or otherwise invalidate it when the proposed publication changes, while retaining human sign-off.

2. **P2 — The visible-disclaimer guard accepts a footer hidden by stylesheet.** `scripts/check-page-policy.ts:10` checks inline style and attributes but does not evaluate stylesheet rules. A temporary HTML fixture containing `<style>.hide {display:none}</style>` and `<footer class="hide"><p data-testid="disclaimer">…approved text…</p></footer>` returned no disclaimer findings even though the footer is not visible. The same applies to a selector in an emitted stylesheet. A normal CSS change could thus hide the disclaimer while the postbuild guard reports success. Verify rendered visibility with a browser or adopt an enforceable static policy covering the styles that can hide the footer.

## Checks and limits

Read the catalogue metadata and PNG integrity paths, repository and release guards, page policy, legal inventory generator, build integration, CI commands and their focused tests. Targeted temporary-root probes reproduced both findings; temporary files were removed. The parent reported the full `npm run verify` passed on Node 22; this review did not rerun it. This review does not establish rights, absence of embedded marks, Tesla in-car compatibility, Cloudflare Access protection, or production release configuration. Those remain separate human or live-environment gates.
