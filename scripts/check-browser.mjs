#!/usr/bin/env node
/* global document, location, getComputedStyle */
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
let screenshotCount = 0;
let pagesAudited = 0;

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

async function screenshot(activePage, name) {
  await activePage.screenshot({
    path: path.join(evidenceDir, `${name}.png`),
    fullPage: true,
  });
  screenshotCount += 1;
}

async function visit(route, name) {
  const response = await page.goto(`${baseURL}${route}`, {
    waitUntil: "networkidle",
  });
  pagesAudited += 1;
  if (!response || response.status() >= 400)
    failures.push(`${route}: expected a successful response`);
  if ((await page.locator("#main-content").count()) !== 1)
    failures.push(`${route}: main landmark missing or duplicated`);
  await screenshot(page, `${name}-desktop`);
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

async function assertArticle(route, expectations = {}) {
  await visit(route, expectations.name ?? "article");
  if ((await page.locator("article.article h1").count()) !== 1)
    failures.push(`${route}: article heading missing or duplicated`);
  if ((await page.locator(".article-body").count()) !== 1)
    failures.push(`${route}: article body missing or duplicated`);
  if ((await page.locator(".article-navigation").count()) !== 1)
    failures.push(`${route}: chronological navigation missing`);
  if ((await page.locator(".return-routes").count()) !== 1)
    failures.push(`${route}: article continuation routes missing`);
  if ((await page.locator(".article-facts").count()) !== 1)
    failures.push(`${route}: article facts missing`);
  if (expectations.longTitle) {
    const box = await page.locator("article.article h1").boundingBox();
    if (!box || box.height < 90)
      failures.push(`${route}: long title did not wrap as expected`);
  }
  if (expectations.notice && (await page.locator(".notice").count()) !== 1)
    failures.push(`${route}: time-sensitivity notice missing`);
  if (
    expectations.disclaimer &&
    (await page.locator(".disclaimer").count()) !== 1
  )
    failures.push(`${route}: legal information notice missing`);
  if (expectations.table) {
    const table = page.locator(".article-body table").first();
    if ((await table.count()) !== 1)
      failures.push(`${route}: expected table missing`);
    else if (
      await table.evaluate(
        (node) =>
          node.getBoundingClientRect().right >
          document.documentElement.clientWidth + 1,
      )
    )
      failures.push(`${route}: table exceeds the desktop viewport`);
  }
  if (expectations.code) {
    const code = page.locator(".article-body pre").first();
    if ((await code.count()) !== 1)
      failures.push(`${route}: expected code block missing`);
    else if (
      (await code.evaluate((node) => getComputedStyle(node).overflowX)) !==
      "auto"
    )
      failures.push(`${route}: code block is not horizontally scrollable`);
  }
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
await visit("/movies/", "movies");
await visit("/archives/", "archives");
await assertArticle("/cetrain-issues-iv-for-company-law/", {
  name: "footnotes",
  notice: true,
  disclaimer: true,
});
await page.locator('a[href="#dfref-footnote-1"]').first().click();
if ((await page.evaluate(() => location.hash)) !== "#dfref-footnote-1")
  failures.push("footnotes: reference did not navigate to footnote 1");
await page.locator('#dfref-footnote-1 a[href="#ref-footnote-1"]').click();
if ((await page.evaluate(() => location.hash)) !== "#ref-footnote-1")
  failures.push("footnotes: backlink did not return to reference 1");

await assertArticle("/hu-bei-gao-yuan-min-er-ting-tong-zhi/", {
  name: "long-title",
  longTitle: true,
  notice: true,
  disclaimer: true,
});
await assertArticle("/vcard-yu-er-wei-ma-ming-pian/", {
  name: "table-code",
  table: true,
  code: true,
});
await assertArticle("/webfont-yu-zhe-zuo-quan/", {
  name: "image-code",
  code: true,
  notice: true,
  disclaimer: true,
});

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
pagesAudited += 1;
if (!response404 || response404.status() !== 404)
  failures.push("404: unknown route did not return HTTP 404");
await screenshot(page, "404-desktop");

const mobile = await browser.newContext({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  reducedMotion: "reduce",
});
const mobilePage = await mobile.newPage();
for (const [route, name] of [
  ["/", "home"],
  ["/topics/technology-digital-life/", "technology-topic"],
  ["/movies/", "movies"],
  ["/webfont-yu-zhe-zuo-quan/", "complex-article"],
  ["/hu-bei-gao-yuan-min-er-ting-tong-zhi/", "long-title-article"],
  ["/vcard-yu-er-wei-ma-ming-pian/", "table-code-article"],
]) {
  await mobilePage.goto(`${baseURL}${route}`, { waitUntil: "networkidle" });
  pagesAudited += 1;
  const overflow = await mobilePage.evaluate(
    () =>
      document.documentElement.scrollWidth >
      document.documentElement.clientWidth + 1,
  );
  if (overflow)
    failures.push(`${route}: horizontal viewport overflow on mobile`);
  await screenshot(mobilePage, `${name}-mobile`);
}

await mobilePage.goto(`${baseURL}/opoo-zhe-teng/`, {
  waitUntil: "networkidle",
});
if ((await mobilePage.locator(".article-neighbor.empty").count()) !== 1)
  failures.push(
    "earliest article: expected one empty boundary navigation item",
  );
await mobilePage.goto(
  `${baseURL}/2023-nian-du-hu-bei-sheng-jiao-tong-shi-gu-pei-chang-biao-zhun-de-tong-ji-shu-ju/`,
  { waitUntil: "networkidle" },
);
if ((await mobilePage.locator(".article-neighbor.empty").count()) !== 1)
  failures.push("latest article: expected one empty boundary navigation item");

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
  pagesAudited,
  screenshots: screenshotCount,
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
  "Browser audit valid: navigation, representative article layouts, search, footnotes, boundary states, 404 behavior, mobile overflow, console, third-party requests, and serious accessibility violations checked.",
);
