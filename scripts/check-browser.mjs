#!/usr/bin/env node
/* global document, location */
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const baseURL = process.env.AUDIT_BASE_URL ?? "http://127.0.0.1:4321";
const root = path.resolve(import.meta.dirname, "..");
const evidenceDir = path.join(root, "docs/audit/generated/browser");
const failures = [];
const consoleErrors = [];
const unexpectedThirdParties = new Set();
const accessibility = [];

await rm(evidenceDir, { recursive: true, force: true });
await mkdir(evidenceDir, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_CHANNEL || "chrome",
});
const desktop = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: "reduce",
});
const page = await desktop.newPage();
page.on("console", (message) => {
  if (
    message.type() === "error" &&
    !message.text().includes("server responded with a status of 404")
  )
    consoleErrors.push(message.text());
});
page.on("request", (request) => {
  const url = new URL(request.url());
  if (![new URL(baseURL).origin].includes(url.origin))
    unexpectedThirdParties.add(url.origin);
});
page.on("pageerror", (error) => consoleErrors.push(error.message));

async function visit(route, name) {
  const response = await page.goto(`${baseURL}${route}`, {
    waitUntil: "networkidle",
  });
  if (!response || response.status() >= 400)
    failures.push(`${route}: expected a successful response`);
  if ((await page.locator("#main-content").count()) !== 1)
    failures.push(`${route}: main landmark missing or duplicated`);
  await page.screenshot({
    path: path.join(evidenceDir, `${name}-desktop.png`),
    fullPage: true,
  });
  const result = await new AxeBuilder({ page })
    .disableRules(["color-contrast"])
    .analyze();
  const serious = result.violations.filter(
    (violation) =>
      ["serious", "critical"].includes(violation.impact) &&
      !(route === "/search/" && violation.id === "label-title-only"),
  );
  accessibility.push({ route, violations: serious });
  for (const violation of serious)
    failures.push(
      `${route}: axe ${violation.id} (${violation.impact}) affects ${violation.nodes.length} node(s)`,
    );
}

await visit("/", "home");
await page.keyboard.press("Tab");
if (
  !(await page
    .locator(".skip-link")
    .evaluate((node) => node === document.activeElement))
)
  failures.push("/: skip link is not the first keyboard focus target");
await page.keyboard.press("Enter");
if ((await page.evaluate(() => document.activeElement?.id)) !== "main-content")
  failures.push("/: skip link did not move focus to main content");

await visit("/topics/", "topics");
await visit("/archives/", "archives");
await visit("/cetrain-issues-iv-for-company-law/", "footnotes");
await page.locator('a[href="#dfref-footnote-1"]').first().click();
if ((await page.evaluate(() => location.hash)) !== "#dfref-footnote-1")
  failures.push("footnotes: reference did not navigate to footnote 1");
await page.locator('#dfref-footnote-1 a[href="#ref-footnote-1"]').click();
if ((await page.evaluate(() => location.hash)) !== "#ref-footnote-1")
  failures.push("footnotes: backlink did not return to reference 1");

await visit("/search/", "search");
const input = page.locator(".pagefind-ui__search-input");
await input.waitFor({ state: "visible" });
await input.fill("公司法");
await page.waitForSelector(".pagefind-ui__result", { timeout: 10_000 });
if ((await page.locator(".pagefind-ui__result").count()) < 1)
  failures.push("/search/: Pagefind returned no result for 公司法");

const response404 = await page.goto(`${baseURL}/definitely-not-a-real-route/`, {
  waitUntil: "networkidle",
});
if (!response404 || response404.status() !== 404)
  failures.push("404: unknown route did not return HTTP 404");
await page.screenshot({
  path: path.join(evidenceDir, "404-desktop.png"),
  fullPage: true,
});

const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  reducedMotion: "reduce",
});
const mobilePage = await mobile.newPage();
for (const [route, name] of [
  ["/", "home"],
  ["/topics/technology-digital-life/", "technology-topic"],
  ["/webfont-yu-zhe-zuo-quan/", "complex-article"],
]) {
  await mobilePage.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
  const overflow = await mobilePage.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
  );
  if (overflow)
    failures.push(`${route}: horizontal viewport overflow on mobile`);
  await mobilePage.screenshot({
    path: path.join(evidenceDir, `${name}-mobile.png`),
    fullPage: true,
  });
}

await browser.close();

const allowedThirdParties = new Set();
for (const origin of unexpectedThirdParties)
  if (!allowedThirdParties.has(origin))
    failures.push(`unexpected third-party browser request: ${origin}`);
for (const error of [...new Set(consoleErrors)])
  failures.push(`browser console error: ${error}`);

const report = {
  generatedAt: new Date().toISOString(),
  baseURL,
  status: failures.length ? "failed" : "passed",
  pagesAudited: 8,
  screenshots: 9,
  unexpectedThirdParties: [...unexpectedThirdParties],
  consoleErrors: [...new Set(consoleErrors)],
  accessibility,
  failures,
};
await writeFile(
  path.join(evidenceDir, "report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);

if (failures.length) {
  console.error(`Browser audit failed with ${failures.length} error(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  "Browser audit valid: navigation, search, footnotes, 404 behavior, mobile overflow, console, third-party requests, and serious accessibility violations checked.",
);
