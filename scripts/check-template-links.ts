import { VARIANTS, templateUrl, type VariantId } from "../src/domain/variants.ts";

const userAgent = "tesla-wrap-workshop-template-links/1.0";

type Outcome = { variant: VariantId; url: string; status: string; ok: boolean };

async function checkVariant(variant: VariantId): Promise<Outcome> {
  const url = templateUrl(variant);
  try {
    const response = await fetch(url, {
      redirect: "follow",
      headers: { "user-agent": userAgent },
      signal: AbortSignal.timeout(30_000),
    });
    return {
      variant,
      url,
      status: String(response.status),
      ok: response.ok,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "request failed";
    return { variant, url, status: `error ${reason}`, ok: false };
  }
}

const variants = Object.keys(VARIANTS) as VariantId[];
const outcomes = await Promise.all(variants.map((variant) => checkVariant(variant)));

let failed = 0;
for (const outcome of outcomes) {
  console.log(`${outcome.variant} ${outcome.url} ${outcome.status}`);
  if (!outcome.ok) {
    failed += 1;
  }
}

if (failed > 0) {
  console.error(`template-links: ${failed} of ${outcomes.length} urls failed`);
  process.exitCode = 1;
}
