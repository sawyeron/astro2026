#!/usr/bin/env node
import process from "node:process";

const origin = (process.argv[2] ?? "").replace(/\/$/, "");
if (!/^https:\/\//.test(origin)) {
  console.error("Usage: npm run check:remote -- https://preview.example.com");
  process.exit(1);
}
const failures = [];
async function check(route, expected = 200, contains) {
  const response = await fetch(`${origin}${route}`, { redirect: "manual" });
  if (response.status !== expected)
    failures.push(`${route}: expected ${expected}, got ${response.status}`);
  const body = await response.text();
  if (contains && !body.includes(contains))
    failures.push(
      `${route}: expected response to contain ${JSON.stringify(contains)}`,
    );
  return { response, body };
}
await check("/", 200, "小法进阶");
await check("/topics/", 200, "专题");
await check("/movies/", 200, "私人观影记录");
await check("/search/", 200, "pagefind-ui.js");
await check("/cetrain-issues-iv-for-company-law/", 200, "dfref-footnote-29");
await check("/rss.xml", 200, "<rss");
await check("/atom.xml", 200, "<feed");
await check("/robots.txt", 200, "sitemap-index.xml");
await check("/sitemap-index.xml", 200, "<sitemapindex");
await check("/keybase.txt", 200);
await check("/google3756ddc34336b7b9.html", 200, "google-site-verification");
await check("/definitely-not-a-real-route/", 404);
const legacyRedirect = await check("/archives/2014/", 308);
if (
  !legacyRedirect.response.headers
    .get("location")
    ?.includes("/archives/?year=2014")
)
  failures.push("/archives/2014/: permanent redirect destination mismatch");
const legacyTimeline = await check("/timeline/", 308);
if (!legacyTimeline.response.headers.get("location")?.includes("/archives/"))
  failures.push("/timeline/: permanent redirect destination mismatch");
const home = await fetch(`${origin}/`);
for (const header of [
  "x-content-type-options",
  "referrer-policy",
  "x-frame-options",
  "permissions-policy",
])
  if (!home.headers.has(header))
    failures.push(`/: missing ${header} response header`);
if (failures.length) {
  console.error(`Remote smoke test failed with ${failures.length} error(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(`Remote smoke test passed for ${origin}.`);
