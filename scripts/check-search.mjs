#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const dist = path.resolve(import.meta.dirname, "../dist");
const failures = [];
async function exists(relative) {
  try {
    await access(path.join(dist, relative));
    return true;
  } catch {
    return false;
  }
}
for (const file of [
  "search/index.html",
  "pagefind/pagefind-ui.js",
  "pagefind/pagefind-ui.css",
  "pagefind/pagefind.js",
])
  if (!(await exists(file))) failures.push(`${file}: missing`);

if (await exists("search/index.html")) {
  const html = await readFile(path.join(dist, "search/index.html"), "utf8");
  if (!html.includes("/pagefind/pagefind-ui.js"))
    failures.push("search page: Pagefind script missing");
  if (!html.includes('id="search"'))
    failures.push("search page: result mount missing");
}

if (failures.length) {
  console.error(`Search validation failed with ${failures.length} error(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  "Static search valid: Pagefind UI and browser-local index assets are present.",
);
