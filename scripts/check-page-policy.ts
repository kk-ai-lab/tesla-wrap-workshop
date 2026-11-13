import { attr, elements, isElement, readBuiltPages, visibleText, type BuiltPages, type HtmlNode } from "./built-pages.ts";

export const DISCLAIMER = "Not affiliated with, endorsed by or sponsored by Tesla, Inc.";
export const BUDGET = { html: 50_000, js: 20_000, thumbnails: 600_000 };
export type PageCheck = "disclaimer" | "budget" | "launch";
export type PagePolicyResult = { findings: string[]; summaries: string[] };

function disclaimerCount(node: HtmlNode, inFooter = false, hidden = false): number {
  if (isElement(node)) {
    hidden ||= ["script", "style", "template", "noscript"].includes(node.tagName) ||
      attr(node, "hidden") !== undefined || attr(node, "aria-hidden") === "true" ||
      /(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(attr(node, "style") ?? "");
    inFooter ||= node.tagName === "footer";
    if (hidden) return 0;
    if (inFooter && attr(node, "data-testid") === "disclaimer" && visibleText(node).replace(/\s+/g, " ").trim() === DISCLAIMER) return 1;
  }
  return "childNodes" in node ? node.childNodes.reduce((count, child) => count + disclaimerCount(child, inFooter, hidden), 0) : 0;
}

function checkDisclaimer(site: BuiltPages): PagePolicyResult {
  const findings = site.pages.filter((page) => disclaimerCount(page.document) !== 1)
    .map((page) => `disclaimer: ${page.file} must have one visible footer disclaimer with the approved text`);
  return { findings, summaries: [`disclaimer: ${site.pages.length - findings.length}/${site.pages.length} pages ok`] };
}

function localAsset(value: string, page: string): string {
  const url = new URL(value, `https://build.invalid/${page}`);
  if (url.origin !== "https://build.invalid") throw new Error(`unmetered external asset ${value}`);
  const decoded = decodeURIComponent(url.pathname);
  if (decoded.includes("\\") || decoded.includes("\0") || decoded.split("/").some((part) => part === "..")) throw new Error(`unsafe asset ${value}`);
  return decoded.replace(/^\/+/, "");
}

function checkBudget(site: BuiltPages): PagePolicyResult {
  const findings: string[] = [];
  let jsBytes = [...site.files].filter(([file]) => /\.[cm]?js$/i.test(file)).reduce((sum, [, bytes]) => sum + bytes.length, 0);
  let largest = site.pages[0];
  for (const page of site.pages) {
    if (largest === undefined || page.bytes > largest.bytes) largest = page;
    if (page.bytes > BUDGET.html) findings.push(`budget: ${page.file} HTML ${page.bytes} exceeds ${BUDGET.html} bytes`);
    const thumbnails = new Set<string>();
    for (const element of elements(page.document)) {
      for (const attribute of element.attrs) if (/^on[a-z]+$/.test(attribute.name)) jsBytes += Buffer.byteLength(attribute.value);
      if (element.tagName === "base") findings.push(`budget: ${page.file} must not change the asset base URL`);
      if (element.tagName === "script") {
        const type = attr(element, "type")?.trim().toLowerCase() ?? "";
        if (["application/json", "application/ld+json", "importmap", "speculationrules"].includes(type)) continue;
        const src = attr(element, "src");
        if (src === undefined) {
          const text = "childNodes" in element ? element.childNodes.map((node) => "value" in node ? node.value : "").join("") : "";
          jsBytes += Buffer.byteLength(text);
        } else {
          try {
            const file = localAsset(src, page.file);
            if (!site.files.has(file)) throw new Error(`missing script ${src}`);
          } catch (error) { findings.push(`budget: ${page.file} ${String(error)}`); }
        }
      }
      if (!["img", "source"].includes(element.tagName)) continue;
      const src = attr(element, "src");
      const candidates = (attr(element, "srcset") ?? "").split(",").map((item) => item.trim().split(/\s+/)[0]).filter((value): value is string => !!value);
      if (src !== undefined) candidates.push(src);
      for (const value of candidates) {
        try {
          const file = localAsset(value, page.file);
          if (!site.files.has(file)) throw new Error(`missing thumbnail ${value}`);
          thumbnails.add(file);
        } catch (error) { findings.push(`budget: ${page.file} ${String(error)}`); }
      }
    }
    const bytes = [...thumbnails].reduce((sum, file) => sum + (site.files.get(file)?.length ?? 0), 0);
    if (bytes > BUDGET.thumbnails) findings.push(`budget: ${page.file} thumbnails ${bytes} exceed ${BUDGET.thumbnails} bytes`);
  }
  if (jsBytes > BUDGET.js) findings.push(`budget: JavaScript ${jsBytes} exceeds ${BUDGET.js} bytes`);
  return { findings, summaries: [`budget: largest HTML ${largest?.file} ${largest?.bytes} bytes; JavaScript ${jsBytes} bytes`] };
}

function checkLaunch(site: BuiltPages, mode: "preview" | "public"): PagePolicyResult {
  const findings: string[] = [];
  for (const page of site.pages) {
    const metas = elements(page.document).filter((element) => element.tagName === "meta" && /^(robots|googlebot|bingbot)$/i.test(attr(element, "name") ?? ""));
    const directives = metas.flatMap((element) => (attr(element, "content") ?? "").toLowerCase().split(/[\s,]+/));
    if (mode === "preview") {
      const head = elements(page.document).find((element) => element.tagName === "head");
      const headRobots = head === undefined ? [] : elements(head).filter((element) => element.tagName === "meta" && attr(element, "name")?.toLowerCase() === "robots");
      const headDirectives = (headRobots[0] === undefined ? "" : attr(headRobots[0], "content") ?? "").toLowerCase().split(/[\s,]+/);
      if (headRobots.length !== 1 || !headDirectives.includes("noindex") || !headDirectives.includes("nofollow") || directives.includes("index") || directives.includes("follow")) {
        findings.push(`launch: ${page.file} must have preview noindex,nofollow in head`);
      }
    } else if (directives.some((value) => ["noindex", "nofollow", "none"].includes(value))) {
      findings.push(`launch: ${page.file} blocks public indexing`);
    }
  }
  const robots = site.files.get("robots.txt")?.toString("utf8").replace(/\r/g, "").trim();
  const expected = mode === "preview" ? "User-agent: *\nDisallow: /" : "User-agent: *\nAllow: /";
  if (robots !== expected) findings.push(`launch: robots.txt must match the ${mode} policy`);
  return { findings, summaries: [`launch: ${mode} policy checked on ${site.pages.length} pages`] };
}

export function checkPagePolicy(root: string, only: PageCheck | undefined, mode: "preview" | "public"): PagePolicyResult {
  try {
    const site = readBuiltPages(root);
    const results = [
      ...(only === undefined || only === "disclaimer" ? [checkDisclaimer(site)] : []),
      ...(only === undefined || only === "budget" ? [checkBudget(site)] : []),
      ...(only === undefined || only === "launch" ? [checkLaunch(site, mode)] : []),
    ];
    return { findings: results.flatMap((result) => result.findings), summaries: results.flatMap((result) => result.summaries) };
  } catch (error) {
    return { findings: [`${only ?? "pages"}: ${error instanceof Error ? error.message : "cannot read build output"}`], summaries: [] };
  }
}
