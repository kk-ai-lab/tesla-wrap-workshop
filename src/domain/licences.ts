export const LICENCES = {
  "CC-BY-4.0": { url: "https://creativecommons.org/licenses/by/4.0/", allows: ["own"] },
  "CC0-1.0": { url: "https://creativecommons.org/publicdomain/zero/1.0/", allows: ["own", "third-party"] },
} as const;

export type LicenceId = keyof typeof LICENCES;
