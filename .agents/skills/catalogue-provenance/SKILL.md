---
name: catalogue-provenance
description: "Exhaustively check third-party wrap attribution and licence rules when changing catalogue provenance validation, its schema, or licence declarations."
---

# Catalogue provenance

Use this skill when a change touches `checkProvenance`, the provenance schema, or the licence registry. A third-party entry is accepted only when its licence allows third-party work, its author is nonblank, both source URLs use absolute HTTP(S) without credentials, and `retrievedOn` is a real `YYYY-MM-DD` calendar date.

## Check

Run from the repository root:

```bash
npm run verify:provenance
```

The script calls the real `checkProvenance` function. It checks two licence IDs, four author categories, eight categories for each URL, and eight retrieval-date categories. A passing run checks 4096 abstract inputs. Each sample has an independent expected-valid flag so the checker does not reproduce the production date or URL parser.

The calendar and URL requirements were strengthened after the takeover investigation proved that impossible dates and executable link schemes passed the old rule. The checker includes both leap and non-leap days, invalid schemes, and credential-bearing URLs. It cannot prove that a source or licence claim is truthful. Own-design author validation remains covered by `wrapMetaSchema` tests.

If the check fails, use the printed licence and field categories to inspect the concrete entry. If the validator accepts an entry that violates the rule or rejects one that meets it, report the implementation bug in those terms. Update the property and checker together when policy changes. Keep sample expectations independent of the production validator.

## Coverage record

- Code: `src/domain/wrap.ts` — `checkProvenance`, `licenceAllows`, and `thirdPartyComplete`.
- Policy input: `src/domain/licences.ts` — `LICENCES`.
- Check: `scripts/verify-provenance.ts`, run by `npm run verify:provenance`.
- The hardening design and validation contract are in `docs/design/2026-11-12-maintainer-hardening.md`.
