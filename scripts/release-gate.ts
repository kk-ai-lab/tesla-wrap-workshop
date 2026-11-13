import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { launchMode } from "../src/domain/launch.ts";
import { loadCatalogue } from "../src/catalogue/load.ts";
import { renderLegalCatalogue } from "./legal-packet.ts";

export async function assertReleaseAllowed(root: string, value: string | undefined): Promise<void> {
  if (launchMode(value) === "preview") return;
  const packet = readFileSync(path.join(root, "docs/legal-review.md"), "utf8");
  if (!/^LEGAL_SIGNOFF:[ \t]*\S[^\r\n]*$/m.test(packet)) {
    throw new Error("public build blocked: Kai must record legal sign-off in docs/legal-review.md");
  }
  const catalogue = await loadCatalogue(path.join(root, "content/wraps"));
  if (!catalogue.ok) throw new Error("public build blocked: invalid catalogue");
  const rendered = renderLegalCatalogue(catalogue.catalogue);
  const inventory = readFileSync(path.join(root, "docs/legal-catalogue.md"), "utf8");
  const approvedHash = /^LEGAL_CATALOGUE_SHA256:[ \t]*([a-f0-9]{64})[ \t]*$/m.exec(packet)?.[1];
  const actualHash = createHash("sha256").update(rendered).digest("hex");
  if (inventory !== rendered || approvedHash !== actualHash) {
    throw new Error("public build blocked: catalogue differs from the inventory approved by Kai");
  }
}
