import { z } from "zod";
import { LICENCES, type LicenceId } from "./licences";
import type { Violation } from "./spec";
import { VARIANTS, type VariantId } from "./variants";

function isDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !!url.hostname && !url.username && !url.password && value.trim() === value;
  } catch {
    return false;
  }
}

function registryKeys<T extends Record<string, unknown>>(
  registry: T,
): [keyof T & string, ...(keyof T & string)[]] {
  const keys = Object.keys(registry).filter((key): key is keyof T & string =>
    Object.prototype.hasOwnProperty.call(registry, key),
  );
  const first = keys[0];
  if (first === undefined) {
    throw new Error("empty registry");
  }
  return [first, ...keys.slice(1)];
}

const ownProvenanceSchema = z
  .object({
    kind: z.literal("own"),
    author: z.string().refine((value) => value.trim() !== ""),
    createdWith: z.string().optional(),
    sourceUrl: z.string().refine(isHttpUrl).optional(),
  })
  .strict();

const thirdPartyProvenanceSchema = z
  .object({
    kind: z.literal("third-party"),
    author: z.string().optional(),
    sourceUrl: z.string().optional(),
    sourceLicenceUrl: z.string().optional(),
    retrievedOn: z.string().optional(),
  })
  .strict();

const provenanceSchema = z.discriminatedUnion("kind", [ownProvenanceSchema, thirdPartyProvenanceSchema]);

export const wrapMetaSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]{3,40}$/),
    title: z.string().max(80).refine((value) => value.trim() !== ""),
    variant: z.enum(registryKeys(VARIANTS)),
    file: z.string(),
    licence: z.enum(registryKeys(LICENCES)),
    provenance: z.array(provenanceSchema).min(1),
    tags: z.array(z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).max(8),
    addedOn: z.string().refine(isDate),
  })
  .strict();

export type WrapMeta = z.infer<typeof wrapMetaSchema>;

export type Wrap = WrapMeta & {
  width: number;
  height: number;
  bytes: number;
  sha256: string;
};

export type Catalogue = {
  wraps: readonly Wrap[];
  byVariant: ReadonlyMap<VariantId, readonly Wrap[]>;
};

function licenceAllows(licence: LicenceId, kind: "own" | "third-party"): boolean {
  const allows: readonly string[] = LICENCES[licence].allows;
  return allows.includes(kind);
}

function filled(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== "";
}

function thirdPartyComplete(entry: {
  author?: string;
  sourceUrl?: string;
  sourceLicenceUrl?: string;
  retrievedOn?: string;
}): boolean {
  return (
    filled(entry.author) &&
    isHttpUrl(entry.sourceUrl ?? "") &&
    isHttpUrl(entry.sourceLicenceUrl ?? "") &&
    isDate(entry.retrievedOn ?? "")
  );
}

export function checkProvenance(
  licence: LicenceId,
  provenance: readonly WrapMeta["provenance"][number][],
): Array<Extract<Violation, { code: "licence-provenance" }>> {
  const violations: Array<Extract<Violation, { code: "licence-provenance" }>> = [];
  for (const entry of provenance) {
    if (!licenceAllows(licence, entry.kind) || (entry.kind === "third-party" && !thirdPartyComplete(entry))) {
      violations.push({ code: "licence-provenance", licence, kind: entry.kind });
    }
  }
  return violations;
}
