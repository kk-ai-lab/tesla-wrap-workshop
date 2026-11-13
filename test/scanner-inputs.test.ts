import { expect, it } from "vitest";
import { runCommentLintKindCheck, runScannerInputCheck } from "../scripts/check-scanner-inputs.ts";

it("every dist scanner input kind has a bad fixture", () => {
  const result = runScannerInputCheck();
  expect(result).toEqual({ status: 0, text: "" });
});

it("every comment lint kind has a bad fixture", async () => {
  const result = await runCommentLintKindCheck();
  expect(result).toEqual({ status: 0, text: "" });
});
