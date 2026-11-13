import { spawnSync } from "node:child_process";
import { cp, mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

it("checks the workspace catalogue", () => {
  const result = spawnSync(path.join(repoRoot, "node_modules/.bin/tsx"), ["src/cli/check.ts"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  expect(result.status).toBe(0);
  expect(result.stdout).toMatch(/^check: [1-9]\d* wraps?, 0 violations\n$/);
}, 60_000);

it("prints a too-big line for a temp root", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "wrap-check-"));
  const folder = "oversized";
  try {
    await mkdir(path.join(root, folder));
    const meta = {
      id: folder,
      title: "Too Big",
      variant: "model3",
      file: "too-big.png",
      licence: "CC0-1.0",
      provenance: [{ kind: "own", author: "kk-ai-lab" }],
      tags: ["sample"],
      addedOn: "2026-11-09",
    };
    await writeFile(path.join(root, folder, "meta.json"), JSON.stringify(meta));
    await cp(path.resolve("test/fixtures/too-big.png"), path.join(root, folder, "too-big.png"));
    const result = spawnSync(path.join(repoRoot, "node_modules/.bin/tsx"), ["src/cli/check.ts", root], {
      cwd: repoRoot,
      encoding: "utf8",
    });
    expect(result.status).toBe(1);
    expect(result.stdout.split("\n")).toContain(`too-big 1000001 bytes ${folder}`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}, 60_000);
