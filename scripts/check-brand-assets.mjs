#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const failures = [];
for (const file of [
  "public/favicon.svg",
  "dist/favicon.svg",
  "dist/index.html",
]) {
  try {
    await access(path.join(root, file));
  } catch {
    failures.push(`${file}: missing`);
  }
}
try {
  const svg = await readFile(path.join(root, "public/favicon.svg"), "utf8");
  if (!/<title\b/i.test(svg))
    failures.push("public/favicon.svg: accessible title missing");
  if (!/viewBox=/i.test(svg))
    failures.push("public/favicon.svg: viewBox missing");
  const home = await readFile(path.join(root, "dist/index.html"), "utf8");
  if (!/<link\s+rel="icon"\s+href="\/favicon\.svg"/i.test(home))
    failures.push("homepage: favicon discovery link missing");
} catch (error) {
  failures.push(`brand asset read failed: ${error.message}`);
}
if (failures.length) {
  console.error(
    `Brand asset validation failed with ${failures.length} error(s):`,
  );
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  "Brand assets valid: accessible SVG favicon is published and discovered.",
);
