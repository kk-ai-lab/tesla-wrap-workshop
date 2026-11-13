# Legal review packet

This packet records the questions and evidence for Kai and counsel. It is not legal approval. Regenerating the [catalogue inventory](legal-catalogue.md) does not change this file or its sign-off.

## Proposed publication

- Repository and project name are `tesla-wrap-workshop`.
- The visible site name is Wrap workshop. Tesla is named to describe vehicle compatibility.
- Production domain is not configured. The existing decision is to use a Cloudflare `pages.dev` address initially.
- A Cloudflare Pages project and preview Access policy are configured. No preview has been deployed or verified with the site content.
- The site is a curated gallery with downloads. It has no visitor uploads, accounts, payment processing, or comments.
- The [catalogue inventory](legal-catalogue.md) records the files, hashes, licences, authors, and provenance currently proposed for publication.

## Disclaimer

Not affiliated with, endorsed by or sponsored by Tesla, Inc.

The disclaimer is visible in every page footer. It does not establish permission to use a trademark or redistribute artwork.

## Questions for counsel

1. Is the project name and its descriptive use of Tesla acceptable for the chosen domain and presentation?
2. Does making original designs for Tesla's UV layout create a derivative-work obligation? The upstream repository has no licence file at the [checked revision](compatibility.md).
3. Are the per-design CC0-1.0 and CC-BY-4.0 notices and recorded provenance sufficient for the proposed files?
4. Is the disclaimer adequate? Are any further notices or changes needed before public availability?

Tesla templates, examples, and vehicle images are linked from the official repository. The project does not distribute the downloaded source-template files as standalone assets. The twelve local imagegen candidates directly retain pixels from the corresponding official Tesla templates around the masked texture areas; see [candidate artwork](candidate-artwork.md). Permission and derivative-work clearance remain outstanding. Exact-hash checks cannot detect all altered copies or embedded logos. A human reviewer must inspect each image and its source-licence evidence.

## Release evidence still required

- Review every proposed design and its rights record.
- Complete [in-car checks](in-car-tests.md) without inferring results from file checks.
- Verify Cloudflare Access and the release-branch configuration on a real protected preview.
- Record counsel's advice and Kai's decision here. After reviewing the exact catalogue inventory, record its SHA-256 beside the sign-off. Keep supporting evidence with the signed commit. A later inventory change requires another review and updated hash.

LEGAL_SIGNOFF:
LEGAL_CATALOGUE_SHA256:
