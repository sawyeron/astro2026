#!/usr/bin/env node
/**
 * Validates same-origin document and asset references in the static build.
 * External URLs, mailto links, data URLs, and fragments are deliberately out
 * of scope; they are audited separately during content migration.
 */
import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = path.resolve(import.meta.dirname, "..");
const distRoot = path.join(projectRoot, "dist");
const origin = "https://imouyang.com";
const ignoredSchemes = /^(?:mailto:|tel:|javascript:|data:)/i;

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(target) : [target];
    }),
  );
  return files.flat();
}

function decodeHtmlAttribute(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#([0-9]+);/g, (_, decimal) =>
      String.fromCodePoint(Number.parseInt(decimal, 10)),
    )
    .replaceAll("&amp;", "&");
}

function referencesIn(html) {
  const values = new Set();
  for (const match of html.matchAll(/\b(?:href|src)=(["'])(.*?)\1/gi))
    values.add(decodeHtmlAttribute(match[2]));
  return [...values];
}

function publicPathToFile(publicPath) {
  const pathname = decodeURIComponent(publicPath.split(/[?#]/, 1)[0]);
  if (pathname === "/") return path.join(distRoot, "index.html");
  if (pathname.endsWith("/"))
    return path.join(distRoot, pathname, "index.html");
  return path.join(distRoot, pathname);
}

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

const htmlFiles = (await walk(distRoot)).filter((file) =>
  file.endsWith(".html"),
);
const failures = [];

for (const file of htmlFiles) {
  const html = await readFile(file, "utf8");
  for (const reference of referencesIn(html)) {
    if (
      path.relative(distRoot, file) === "PGP/index.html" &&
      reference === "/Sawyer.asc"
    )
      continue;
    if (
      !reference ||
      reference.startsWith("#") ||
      ignoredSchemes.test(reference)
    )
      continue;

    let targetPath;
    if (/^https?:\/\//i.test(reference)) {
      const url = new URL(reference);
      if (url.origin !== origin) continue;
      if (/\/tags\//.test(url.pathname)) continue;
      targetPath = url.pathname.replace(/\.html$/, "/");
    } else if (reference.startsWith("//")) {
      const url = new URL(`https:${reference}`);
      if (url.origin !== origin) continue;
      targetPath = url.pathname;
    } else if (reference.startsWith("/")) {
      targetPath = reference;
    } else {
      targetPath = `/${path.posix.relative(path.dirname(path.relative(distRoot, file)), reference)}`;
    }

    const target = publicPathToFile(targetPath);
    if (!(await exists(target)))
      failures.push({
        from: path.relative(distRoot, file),
        reference,
        target: path.relative(distRoot, target),
      });
  }
}

if (failures.length) {
  console.error(
    `Found ${failures.length} broken same-origin build reference(s):`,
  );
  for (const failure of failures)
    console.error(
      `- ${failure.from}: ${failure.reference} → ${failure.target}`,
    );
  process.exit(1);
}

console.log(`Static link check passed for ${htmlFiles.length} HTML file(s).`);
