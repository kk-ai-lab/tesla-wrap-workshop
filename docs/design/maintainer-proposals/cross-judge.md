# Architecture cross-judge

The goal is to make the curated Tesla Paint Shop gallery locally ready while preserving its static design and keeping legal and deployment approval as separate gates. This review compares the two proposals against the current code and recommends an incremental path.

## Scores

Scores are 1 (weak) to 5 (strong). For cost, 5 means the smallest API and diff cost.

| Candidate | API/diff cost | Integrity and unsafe-input correctness | Ownership and extensibility | Testability | Incremental delivery |
|---|---:|---:|---:|---:|---:|
| A: incremental hardening | 5 | 4 | 5 | 5 | 5 |
| B: validated catalogue and shared site model | 3 | 5 | 4 | 5 | 3 |

## Recommendation

Use A as the base. It preserves `checkPng`, `loadCatalogue`, `checkLinks(root)`, and the existing gallery verifier while adding integrity validation at the catalogue filesystem boundary. The source confirms the primary gaps: `checkPng` accepts a 24-byte header, `loadCatalogue` reads the metadata filename before checking its policy, provenance URLs and calendar dates are weakly validated, and post-build dispatch currently covers links alone.

Graft two ideas from B:

1. Use B's shared built-site reader for the new disclaimer, budget, and launch checks. Keep the existing links and gallery check signatures and behavior stable. Keep the comment checker separate because its scripting and comment parsing semantics differ.
2. Use B's single exact-value launch-mode parser in both generated robots controls and the local launch check. Default to preview and fail on malformed values. Treat local output as a check of generated controls only; private Access, branch protections, legal review, and release remain external gates.

Also adopt B's narrow improvements to A's boundaries: use `lstat` to reject symlinked catalogue entries, require ordinary files, compare copied source bytes with the catalogue hash, and fail closed when guard manifests or built output are missing or malformed. These checks strengthen A without adopting its proposed cross-caller validated-PNG API migration.

## Main synthesis flaw

The shared reader graft has a limited payoff if it serves only new content checks: `checkLinks(root)` and `verify-gallery.ts` will continue their own traversal and parsing. Calling both the old link checker and the new reader in one post-build command parses the same HTML twice, and creates two interpretations of URL/path handling. This is an acceptable staged tradeoff if the reader is kept private to the new checks and its file/URL rules are explicit. It should not be described as one shared parse across all post-build checks. If eliminating duplicate parsing becomes important, migrate `checkLinks` later behind its existing `checkLinks(root)` wrapper, with behavior-preserving tests; do not migrate the gallery regex interface in this first tranche.

One further caveat: A's `checkPng` remains a header/spec check, not proof of valid PNG integrity. Give the new helper a distinct name and make `loadCatalogue` require both checks so no caller can mistake the old result for full integrity validation. B's parsed result makes that invariant clearer but costs broader caller changes. A's staged boundary is the better current tradeoff.

## Delivery order

1. Harden metadata, filename/path and symlink checks; add bounded PNG structural checks plus full Sharp decode at catalogue load. Keep exact source bytes and hashes for download copying. Add malformed input and valid PNG fixture coverage.
2. Add no-rehost and brand policy checks with pinned, complete manifest evidence. Wire the default `npm run check` path and CI. Keep limitations of exact-hash matching explicit.
3. Add the built-site reader for new footer, byte-budget, and preview/public-control checks; make post-build default to all checks and CI invoke that default. Preserve existing links and gallery interfaces.
4. Add legal inventory and in-car records as clearly unsigned/untested artifacts. Do not seed artwork or claim vehicle compatibility without human evidence.

The candidate designs and current code support local readiness work only. Neither architecture establishes Tesla compatibility in a vehicle, licensing rights, preview access control, or authorization to launch.
