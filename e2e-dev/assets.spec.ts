import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { loadCatalogue } from "../src/catalogue/load.ts";

test("development gallery serves previews and exact original downloads", async ({ page, request }) => {
  const result = await loadCatalogue("content/wraps");
  if (!result.ok) throw new Error("browser checks require a valid catalogue");
  const wrap = result.catalogue.wraps.find((item) => item.file.includes(" "));
  if (!wrap) throw new Error("browser checks require a filename containing a space");

  await page.goto("/");
  const images = page.locator(".wrap-card img");
  await expect(images).toHaveCount(result.catalogue.wraps.length);
  for (const image of await images.all()) {
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  }
  await page.goto(`/wraps/${wrap.id}/`);
  await expect.poll(() => page.locator(".detail-preview img").evaluate((element: HTMLImageElement) => element.complete && element.naturalWidth > 0)).toBe(true);
  const downloadLink = page.getByRole("link", { name: `Download ${wrap.file}`, exact: true });
  await expect(downloadLink).toHaveAttribute("download", wrap.file);
  const [download] = await Promise.all([page.waitForEvent("download"), downloadLink.click()]);
  expect(download.suggestedFilename()).toBe(wrap.file);
  const downloadedPath = await download.path();
  if (downloadedPath === null) throw new Error("download did not produce a file");
  expect(await readFile(downloadedPath)).toEqual(await readFile(`content/wraps/${wrap.id}/${wrap.file}`));
  const href = `/wraps/${wrap.id}/${encodeURIComponent(wrap.file)}`;
  const response = await request.get(href);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toBe("image/png");
  expect(await response.body()).toEqual(await readFile(`content/wraps/${wrap.id}/${wrap.file}`));
  const thumb = await request.get(`/thumbs/${wrap.id}.webp?cache=1`);
  expect(thumb.status()).toBe(200);
  expect(thumb.headers()["content-type"]).toBe("image/webp");
  expect((await request.head(`/thumbs/${wrap.id}.webp`)).status()).toBe(200);
  for (const item of result.catalogue.wraps) {
    const asset = await request.get(`/wraps/${item.id}/${encodeURIComponent(item.file)}?download=1`);
    expect(asset.status()).toBe(200);
    expect(await asset.body()).toEqual(await readFile(`content/wraps/${item.id}/${item.file}`));
  }
  const head = await request.head(href);
  expect(head.status()).toBe(200);
  expect(head.headers()["content-length"]).toBe(String(wrap.bytes));
  expect((await head.body()).length).toBe(0);
  expect((await request.get("/thumbs/does-not-exist.webp")).status()).toBe(404);
  expect((await request.get(`/wraps/${wrap.id}/meta.json`)).status()).toBe(404);
  expect((await request.get(`/wraps/${wrap.id}/%2Fmeta.json`)).status()).toBe(404);
  expect((await request.get(`/wraps/${wrap.id}/%2e%2e%2fmeta.json`)).status()).toBe(404);
  expect((await request.get("/thumbs/%ZZ.webp")).status()).toBeGreaterThanOrEqual(400);
  expect((await request.post(href)).status()).toBe(405);
});
