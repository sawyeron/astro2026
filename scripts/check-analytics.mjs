#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const dist = path.resolve(import.meta.dirname, "../dist");
const expectedToken = process.env.PUBLIC_CF_BEACON_TOKEN?.trim();
const failures = [];
let beaconPages = 0;

async function htmlFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await htmlFiles(target)));
    else if (entry.name.endsWith(".html")) files.push(target);
  }
  return files;
}

for (const file of await htmlFiles(dist)) {
  const relative = path.relative(dist, file);
  if (relative === "google3756ddc34336b7b9.html") continue;
  const html = await readFile(file, "utf8");
  const matches =
    html.match(/https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js/g) ??
    [];
  if (matches.length > 1)
    failures.push(`${relative}: Cloudflare beacon injected more than once`);
  if (matches.length === 1) {
    beaconPages += 1;
    if (!/\bdefer(?:="")?/i.test(html))
      failures.push(`${relative}: beacon script is not deferred`);
    if (!/data-cf-beacon=/i.test(html))
      failures.push(`${relative}: beacon configuration missing`);
    if (expectedToken && !html.includes(expectedToken))
      failures.push(`${relative}: expected beacon token missing`);
  }
  if (/googletagmanager|google-analytics\.com|gtag\(/i.test(html))
    failures.push(`${relative}: prohibited Google analytics integration found`);
}

if (expectedToken && beaconPages === 0)
  failures.push("PUBLIC_CF_BEACON_TOKEN is set but no beacon was emitted");
if (!expectedToken && beaconPages > 0)
  failures.push("Cloudflare beacon emitted without PUBLIC_CF_BEACON_TOKEN");
if (failures.length) {
  console.error(
    `Analytics validation failed with ${failures.length} error(s):`,
  );
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  expectedToken
    ? `Analytics valid: Cloudflare beacon emitted on ${beaconPages} HTML page(s).`
    : "Analytics valid: no production token configured, so no beacon was emitted.",
);
