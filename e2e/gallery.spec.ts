import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { VARIANTS } from "../src/domain/variants.ts";
import { LICENCES } from "../src/domain/licences.ts";
import { loadCatalogue } from "../src/catalogue/load.ts";

const disclaimer = "Not affiliated with, endorsed by or sponsored by Tesla, Inc.";

test("shows the disclaimer and readable content on every generated page", async ({ page }, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  const catalogue = await loadCatalogue("content/wraps");
  if (!catalogue.ok) throw new Error("browser checks require a valid catalogue");
  const routes = ["/", "/about/", ...catalogue.catalogue.wraps.map((wrap) => `/wraps/${wrap.id}/`), ...Object.keys(VARIANTS).map((variant) => `/models/${variant}/`)];
  for (const route of routes) {
    const response = await page.goto(route);
    expect(response?.status()).toBe(200);
    await expect(page.locator("h1")).toBeVisible();
    const footer = page.getByTestId("disclaimer");
    await expect(footer).toBeVisible();
    await footer.scrollIntoViewIfNeeded();
    await expect(footer).toHaveText(disclaimer);
    await expect(footer).toBeVisible();
    expect(await footer.evaluate((element) => {
      let node: Element | null = element;
      while (node !== null) {
        const style = getComputedStyle(node);
        if (Number(style.opacity) === 0 || style.visibility !== "visible" || style.display === "none") return false;
        node = node.parentElement;
      }
      return element.getBoundingClientRect().width > 0;
    })).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  expect(errors).toEqual([]);
  await page.goto("/");
  await page.screenshot({ path: testInfo.outputPath("home.png"), fullPage: true });
});

test("browses by vehicle, reads provenance and downloads exact PNG bytes", async ({ page, request }, testInfo) => {
  await page.goto("/");
  await page.locator('a[href="/models/model3/"]').click();
  await expect(page).toHaveURL(/\/models\/model3\/$/);
  await page.getByRole("link", { name: "View details", exact: true }).and(page.locator('[href="/wraps/sample-solid-grey/"]')).click();
  await expect(page).toHaveURL(/\/wraps\/sample-solid-grey\/$/);
  await expect(page.locator("h1")).toHaveText("Solid Grey");
  await expect(page.locator(".provenance")).toContainText("kk-ai-lab");
  const link = page.getByRole("link", { name: "Download Solid Grey.png", exact: true });
  await expect(link).toHaveAttribute("download", "Solid Grey.png");
  const href = await link.getAttribute("href");
  if (href === null) throw new Error("download link must have a URL");
  const response = await request.get(href);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/png");
  expect(await response.body()).toEqual(await readFile("content/wraps/sample-solid-grey/Solid Grey.png"));
  await page.screenshot({ path: testInfo.outputPath("wrap.png"), fullPage: true });
  await page.getByRole("navigation", { name: "Main navigation" }).getByRole("link", { name: "About & install" }).click();
  await expect(page).toHaveURL(/\/about\/$/);
  await expect(page.getByRole("heading", { name: "With the mobile app" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "With a USB drive" })).toBeVisible();
});


test("shows each design’s rights status and serves original files for every vehicle", async ({ page, request }) => {
  const result = await loadCatalogue("content/wraps");
  if (!result.ok) throw new Error("browser checks require a valid catalogue");
  await page.goto("/");
  for (const wrap of result.catalogue.wraps.filter((item) => item.tags.includes("candidate"))) {
    const card = page.locator(".wrap-card").filter({ has: page.locator(`a[href="/wraps/${wrap.id}/"]`) });
    await expect(card).toContainText("Candidate · licence pending review; no reuse rights granted");
  }
  for (const variant of Object.keys(VARIANTS)) {
    const expected = result.catalogue.wraps.filter((wrap) => wrap.variant === variant);
    await page.goto(`/models/${variant}/`);
    await expect(page.locator(".wrap-card")).toHaveCount(expected.length);
    for (const wrap of expected) {
      const card = page.locator(".wrap-card").filter({ has: page.locator(`a[href="/wraps/${wrap.id}/"]`) });
      await expect(card).toContainText(wrap.title);
      if (wrap.tags.includes("candidate")) {
        await expect(card).toContainText("Candidate · licence pending review; no reuse rights granted");
      } else {
        await expect(card.locator(".micro-label")).toContainText(wrap.licence);
        await expect(card).not.toContainText("licence pending review");
      }
      await card.getByRole("link", { name: "View details" }).click();
      await expect(page.locator("h1")).toHaveText(wrap.title);
      if (wrap.tags.includes("candidate")) {
        await expect(page.locator(".meta")).toContainText("Candidate · licence pending review; no reuse rights granted");
        await expect(page.locator(".meta").getByRole("link", { name: wrap.licence, exact: true })).toHaveCount(0);
      } else {
        const licence = page.locator(".meta").getByRole("link", { name: wrap.licence, exact: true });
        await expect(licence).toHaveAttribute("href", LICENCES[wrap.licence].url);
        await expect(page.locator(".meta")).not.toContainText("licence pending review");
      }
      const link = page.getByRole("link", { name: `Download ${wrap.file}`, exact: true });
      await expect(link).toHaveAttribute("download", wrap.file);
      const href = await link.getAttribute("href");
      if (href === null) throw new Error("download link must have a URL");
      const response = await request.get(href);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toContain("image/png");
      expect(await response.body()).toEqual(await readFile(`content/wraps/${wrap.id}/${wrap.file}`));
      await page.goto(`/models/${variant}/`);
    }
  }
  await page.goto("/wraps/sample-solid-grey/");
  await expect(page.locator(".meta").getByRole("link", { name: "CC0-1.0" })).toBeVisible();
  await page.goto("/about/");
  await expect(page.locator("#sources")).toContainText("their proposed CC0 designation does not grant reuse rights");
});
