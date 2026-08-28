#!/usr/bin/env node
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const dist = path.resolve(import.meta.dirname, "../dist");
const failures = [];

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
  if (!/<html\b[^>]*lang="zh-CN"/i.test(html))
    failures.push(`${relative}: html lang missing`);
  if (!/<meta\s+name="viewport"/i.test(html))
    failures.push(`${relative}: viewport missing`);
  if (!/<title>[^<]+<\/title>/i.test(html))
    failures.push(`${relative}: title missing`);
  if (!/<meta\s+name="description"/i.test(html))
    failures.push(`${relative}: description missing`);
  if (!/<link\s+rel="canonical"/i.test(html))
    failures.push(`${relative}: canonical missing`);
  if (!/<main\b[^>]*id="main-content"/i.test(html))
    failures.push(`${relative}: main landmark missing`);
  if (!/href="#main-content"/i.test(html))
    failures.push(`${relative}: skip link missing`);
  if (!/data-pagefind-body/i.test(html))
    failures.push(`${relative}: Pagefind body marker missing`);
  if (/<img\b/i.test(html)) {
    for (const match of html.matchAll(/<img\b[^>]*>/gi))
      if (!/\balt=(?:"[^"]*"|'[^']*')/i.test(match[0]))
        failures.push(`${relative}: image without alt attribute`);
  }
}

if (failures.length) {
  console.error(
    `HTML quality validation failed with ${failures.length} error(s):`,
  );
  for (const failure of failures.slice(0, 100)) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  "HTML quality valid: metadata, landmarks, search scope, skip links, and image alternatives passed.",
);
