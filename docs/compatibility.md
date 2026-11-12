# Wrap compatibility

Checked on 12 November 2026 against Tesla's [official custom-wraps repository](https://github.com/teslamotors/custom-wraps), at commit [`86c7d31454caf0f20af6f6af105f577643f13bce`](https://github.com/teslamotors/custom-wraps/tree/86c7d31454caf0f20af6f6af105f577643f13bce).

These are files for the vehicle's Paint Shop visualization. They are not files for printing a physical vehicle wrap.

## Tesla requirements and workshop policy

| Property | Tesla's README | Workshop policy |
|---|---|---|
| Format | PNG | PNG with intact chunks and decodable image data |
| Resolution | 512x512 to 1024x1024; use template size for best results | Match the selected variant's template exactly |
| File size | At most 1 MB | At most 1,000,000 bytes |
| Filename | Letters, numbers, underscores, dashes, and spaces; at most 30 characters | ASCII letters and numbers, `_`, `-`, and spaces; 1 to 26 characters before lowercase `.png`, at most 30 total |
| Quantity in vehicle | Up to 10 from the app and 10 from USB | Installation guidance repeats these limits |

Tesla does not define MB as decimal or binary in this README, or say whether the extension counts toward 30 characters. The workshop chooses the smaller limits. Those choices are not evidence that Tesla rejects every file outside them.

The registry has 12 variants. The Cybertruck template is 1024x768. The other 11 templates are 1024x1024. The official README recommends template dimensions despite describing the resolution range using square examples. File checks do not prove panel alignment or successful use on a vehicle.

## Transfer a downloaded wrap

Choose the exact vehicle variant before downloading. Keep the downloaded PNG's filename.

For the Tesla mobile app, use version 4.59.0 or later. Open **Creations**, then **Wrap**, then **Upload**. Tesla's README does not specify a minimum vehicle software version, so this project does not infer one.

For USB, format the drive as exFAT, FAT32, MS-DOS FAT, ext3, or ext4. NTFS is unsupported. Create a folder named `Wraps` at the drive root and place the PNG inside it. The drive must not contain map or firmware updates.

In the vehicle, open **Toybox**, then **Paint Shop**, then the **Wraps** tab.

## Content and provenance

The official README checked above contains file and transfer instructions. It does not supply a separate image-content policy or a redistribution licence. The upstream tree contains no licence file at the checked commit. This is an observation about the repository, not a legal conclusion about any individual design.

The workshop's own content policy comes from [the project decisions](decisions.md). Publish original work or work made from documented public-domain or CC0 sources. Output licences are CC0-1.0 or CC-BY-4.0. Link to Tesla's templates, examples, and vehicle images instead of copying them into this repository. A reviewer must check rights, provenance, third-party marks, and characters. Automated file and hash checks cannot establish those facts or recognize every logo drawn into an image.

The remaining legal question concerns designs made for Tesla's UV layout. It remains open for counsel. [The legal packet](legal-review.md) and [in-car test record](in-car-tests.md) track the release evidence.

## Updating the evidence

Read the current official README and inspect any new vehicle folders before changing the registry. Regenerate the upstream image hash manifest from a pinned commit. Inspect the diff before accepting it. CI uses the committed snapshot and does not fetch upstream images during normal builds.

The research report from 4 November remains a historical record. Its section 3 suggested a 1,048,576-byte limit and a 30-character stem. The later design and implementation use the stricter limits in this document. The report already recorded mobile app transfer support; it did not need that fact added.
