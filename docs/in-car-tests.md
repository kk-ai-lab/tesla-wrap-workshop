# In-car test record

No in-car tests have been performed by this maintainer run. Automated PNG, byte, and dimension checks do not prove installation or UV alignment.

Record the exact file SHA-256, vehicle variant, vehicle software, app version if used, transfer method, date, tester, result, and evidence. Keep the original download filename. Use `pass`, `fail`, or `untested` as the result.

| Vehicle | File SHA-256 | Vehicle software | App version | Transfer | Date and tester | Result | Evidence |
|---|---|---|---|---|---|---|---|
| Model 3 pre-Highland, `Tidal Jade.png` | `88fef1d987d4b81d634c7eb8149ba9303f0f48c29f919b1edff0b9b610e6f986` | Unknown | Unknown | Pending | Not tested | untested | None |
| Model Y pre-Juniper, `Pine Canopy.png` | `dad1fecc3de82b7f65528f9043d68d9c44187496e55ee84fef3d596a099505af` | Unknown | Unknown | Pending | Not tested | untested | None |
| Cybertruck, `Copper Circuit.png` | `79dcdc1510a2c3ae95ba06da9340104685786ded92fe431be378735e80bd6de7` | Unknown | Unknown | Pending | Not tested | untested | None |

For each chosen design, inspect the panel alignment in Paint Shop after transfer. Include a boundary file between 999,900 and 1,000,000 bytes with a 30-character filename including `.png`. Record actual observations; do not change the workshop's conservative byte or filename policy based on a desktop parser result.

I10 still requires review of the template-based candidates for all 12 variants and at least these three vehicle checks. See [candidate artwork](candidate-artwork.md) for their origin and limitations. The grey sample is development content.

The selected files are provisional and depend on vehicle availability. The [desktop review](reviews/2026-11-13-candidate-desktop-review.md) records observations for all twelve candidates. It is not vehicle evidence or maintainer approval.

A local test kit contains a Model 3 boundary file named `Boundary_Test_123456789012.png`. Its SHA-256 is `ee290858f83f1b41c123e6394692526c828ad5b155e386caa0529d7dd23ea51d`. It is exactly 1,000,000 bytes, its filename has 30 characters, and its decoded pixels match `Tidal Jade.png`. The file uses a large PNG text chunk to reach the size. A rejection could therefore be caused by that chunk, the name, the size, or another factor. It remains untested in a vehicle and is not a catalogue design. The local kit and its generator are ignored working artifacts under `.audit/`.

The kit also includes `Boundary Size.png`, which has the boundary file's exact bytes and a shorter name, and `Filename_Test_123456789012.png`, which has the original Tidal Jade bytes and a 30-character name. Compare each file separately under the same conditions. Duplicate detection could interfere, so record whether each file was independently loaded.

| Model 3 control file | File SHA-256 | Vehicle software | App version | Transfer | Date and tester | Result | Independently loaded and evidence |
|---|---|---|---|---|---|---|---|
| `Filename_Test_123456789012.png` | `88fef1d987d4b81d634c7eb8149ba9303f0f48c29f919b1edff0b9b610e6f986` | Unknown | Unknown | Pending | Not tested | untested | None |
| `Boundary Size.png` | `ee290858f83f1b41c123e6394692526c828ad5b155e386caa0529d7dd23ea51d` | Unknown | Unknown | Pending | Not tested | untested | None |
| `Boundary_Test_123456789012.png` | `ee290858f83f1b41c123e6394692526c828ad5b155e386caa0529d7dd23ea51d` | Unknown | Unknown | Pending | Not tested | untested | None |
