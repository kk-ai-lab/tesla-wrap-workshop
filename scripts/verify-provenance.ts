import { LICENCES, type LicenceId } from "../src/domain/licences.ts";
import { checkProvenance } from "../src/domain/wrap.ts";

type Sample = { label: string; value: string | undefined; valid: boolean };
type ThirdPartyEntry = {
  kind: "third-party";
  author?: string;
  sourceUrl?: string;
  sourceLicenceUrl?: string;
  retrievedOn?: string;
};

const textSamples: readonly Sample[] = [
  { label: "missing", value: undefined, valid: false },
  { label: "empty", value: "", valid: false },
  { label: "whitespace", value: "   ", valid: false },
  { label: "filled", value: "x", valid: true },
];

const urlSamples: readonly Sample[] = [
  ...textSamples.slice(0, 3),
  { label: "unsafe-scheme", value: "javascript:alert(1)", valid: false },
  { label: "not-url", value: "x", valid: false },
  { label: "https", value: "https://example.com/art", valid: true },
  { label: "http", value: "http://example.com/art", valid: true },
  { label: "credentials", value: "https://user:pass@example.com/", valid: false },
];

const dateSamples: readonly Sample[] = [
  ...textSamples.slice(0, 3),
  { label: "malformed", value: "not-a-date", valid: false },
  { label: "real-date", value: "2026-11-09", valid: true },
  { label: "impossible-but-shaped", value: "2026-99-99", valid: false },
  { label: "non-leap-day", value: "2026-02-29", valid: false },
  { label: "leap-day", value: "2028-02-29", valid: true },
];

function makeEntry(
  author: Sample,
  sourceUrl: Sample,
  sourceLicenceUrl: Sample,
  retrievedOn: Sample,
): ThirdPartyEntry {
  const entry: ThirdPartyEntry = { kind: "third-party" };
  if (author.value !== undefined) entry.author = author.value;
  if (sourceUrl.value !== undefined) entry.sourceUrl = sourceUrl.value;
  if (sourceLicenceUrl.value !== undefined) entry.sourceLicenceUrl = sourceLicenceUrl.value;
  if (retrievedOn.value !== undefined) entry.retrievedOn = retrievedOn.value;
  return entry;
}

const licenceIds = Object.keys(LICENCES) as LicenceId[];
let checked = 0;

for (const licence of licenceIds) {
  for (const author of textSamples) {
    for (const sourceUrl of urlSamples) {
      for (const sourceLicenceUrl of urlSamples) {
        for (const retrievedOn of dateSamples) {
          const entry = makeEntry(author, sourceUrl, sourceLicenceUrl, retrievedOn);
          const allowedKinds: readonly string[] = LICENCES[licence].allows;
          const allowedByLicence = allowedKinds.includes("third-party");
          const complete = author.valid && sourceUrl.valid && sourceLicenceUrl.valid && retrievedOn.valid;
          const expectedValid = allowedByLicence && complete;
          const actualValid = checkProvenance(licence, [entry]).length === 0;
          checked += 1;

          if (actualValid !== expectedValid) {
            console.error(
              `verify:provenance: mismatch for ${licence}: author=${author.label}, sourceUrl=${sourceUrl.label}, sourceLicenceUrl=${sourceLicenceUrl.label}, retrievedOn=${retrievedOn.label}; expected ${expectedValid ? "valid" : "invalid"}, got ${actualValid ? "valid" : "invalid"}`,
            );
            process.exitCode = 1;
            process.exit();
          }
        }
      }
    }
  }
}

console.log(`verify:provenance: ${checked} abstract third-party inputs matched the licence and completeness rules`);
