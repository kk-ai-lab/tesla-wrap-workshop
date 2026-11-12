# Catalogue input validation review

The gallery must reject broken or unsafe inputs before reporting a compatible download. Baseline `943b3f6` accepted a 24-byte PNG prefix and a corrupt IHDR checksum. Provenance fields also accepted executable URL schemes and impossible dates.

The change preserves the synchronous header checker and adds full chunk, checksum, end-of-file, and pixel decoding checks at catalogue acceptance. Metadata checks reject unsafe HTTP link values, impossible dates, and blank titles. Filename validation occurs before filesystem reads. Symlinked folders, metadata, and image files fail. The build rechecks source hashes and uses the same bytes for copying and thumbnail generation.

The isolated domain implementation passed 118 tests, lint, typecheck, catalogue checking, build, and gallery verification on Node 22.23.4. Tests include valid Cybertruck dimensions, truncated and corrupt PNGs, recomputed-checksum corrupt compressed data, path and symlink cases, and unsafe metadata. The extended provenance checker evaluates 4096 cases with independent expected-valid sample flags.

Independent reviewers inspected this boundary in the full takeover diff. The final focused review found no remaining boundary defect in scope. [The design](../design/2026-11-12-maintainer-hardening.md) records the chosen contracts and later units. Concurrent filesystem modification is not an atomic snapshot; build-time hash comparison detects changed image bytes before copying. These checks do not prove image rights, UV alignment, or real vehicle acceptance.
