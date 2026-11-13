import { expect, it } from "vitest";
import { renderLegalCatalogue } from "../scripts/legal-packet.ts";
import type { Catalogue, Wrap } from "../src/domain/wrap.ts";

it("records all provenance without generating legal sign-off or table injection", () => {
  const wrap: Wrap = {
    id: "own-art", title: "Grey | <script>\nnew row", variant: "model3", file: "Grey.png", licence: "CC0-1.0",
    provenance: [{ kind: "own", author: "Ada", createdWith: "Paint" }, { kind: "third-party", author: "Bert", sourceUrl: "https://example.com/art", sourceLicenceUrl: "https://example.com/licence", retrievedOn: "2026-11-12" }],
    tags: [], addedOn: "2026-11-12", width: 1024, height: 1024, bytes: 1000, sha256: "a".repeat(64),
  };
  const catalogue: Catalogue = { wraps: [wrap], byVariant: new Map([["model3", [wrap]]]) };
  const result = renderLegalCatalogue(catalogue);
  expect(result).toContain("Grey &#124; &lt;script&gt; new row");
  for (const value of ["Ada", "Paint", "Bert", "https://example.com/art", "https://example.com/licence", "2026-11-12", wrap.sha256]) expect(result).toContain(value);
  expect(result).not.toContain("LEGAL_SIGNOFF:");
  expect(renderLegalCatalogue(catalogue)).toBe(result);
});
