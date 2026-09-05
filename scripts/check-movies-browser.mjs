/* global document, innerWidth */
import process from "node:process";
import { readFile } from "node:fs/promises";
const fixture = await readFile(
  new URL("../public/favicon-32x32.png", import.meta.url),
);
import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
const base = process.env.MOVIES_PREVIEW_URL ?? "http://127.0.0.1:49152";
const browser = await chromium.launch({ channel: "chrome" });

try {
  for (const width of [1440, 390, 375]) {
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      reducedMotion: "reduce",
    });
    await context.route("https://fzzapi.imouyang.com/t/p/**", (route) =>
      route.fulfill({ status: 200, contentType: "image/png", body: fixture }),
    );
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`${base}/movies/`, { waitUntil: "networkidle" });
    assert.equal(await page.locator(".hero-slide").count(), 8);
    assert.equal(await page.locator(".hero-slide.active").count(), 1);
    await page.locator("screening-carousel .next").click();
    assert.equal(
      await page.locator(".hero-slide.active").getAttribute("aria-hidden"),
      "false",
    );
    assert.ok(
      await page
        .locator(".hero-slide:not(.active)")
        .evaluateAll((nodes) => nodes.every((n) => n.inert)),
    );
    assert.ok(await page.locator(".play-toggle").isDisabled());
    for (const id of ["movies", "shows"]) {
      const section = page.locator(`#${id}`);
      assert.equal(await section.locator(".rail-arrow:visible").count(), 0);
      const summary = section.locator("summary");
      await summary.click();
      assert.ok(await section.locator("details").evaluate((e) => e.open));
      await summary.focus();
      await page.keyboard.press("Enter");
      assert.ok(await section.locator("details").evaluate((e) => !e.open));
    }
    assert.ok(
      await page
        .locator("main img")
        .evaluateAll((nodes) =>
          nodes.every(
            (n) =>
              n.decoding === "async" &&
              (n.closest("screening-carousel") || n.loading === "lazy"),
          ),
        ),
    );
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    assert.deepEqual(
      (await new AxeBuilder({ page }).analyze()).violations.map((v) => v.id),
      [],
    );
    assert.deepEqual(errors, []);
    await context.close();
    console.log(`Movies browser: ${width}px passed`);
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  await context.route("https://fzzapi.imouyang.com/t/p/**", (route) =>
    route.fulfill({ status: 200, contentType: "image/png", body: fixture }),
  );
  const page = await context.newPage();
  await page.goto(`${base}/movies/`, { waitUntil: "networkidle" });
  await page.locator("screening-carousel").scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  const active = () =>
    page.locator(".hero-slide.active").getAttribute("aria-label");
  const initial = await active();
  await page.waitForTimeout(5200);
  assert.notEqual(await active(), initial, "4-second autoplay must advance");
  await page.locator("screening-carousel").hover();
  const hovered = await active();
  await page.waitForTimeout(4700);
  assert.equal(await active(), hovered, "Hover must pause autoplay");
  await page.locator(".play-toggle").click();
  await page.mouse.move(0, 0);
  await page.locator(".play-toggle").evaluate((element) => element.blur());
  const paused = await active();
  await page.waitForTimeout(4700);
  assert.equal(await active(), paused, "Explicit pause must persist");
  await context.close();
  console.log("Movies autoplay advancement, hover and explicit pause passed");
} finally {
  await browser.close();
}
