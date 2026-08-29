#!/usr/bin/env node
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  await readFile(
    path.join(projectRoot, "docs/audit/auxiliary-url-manifest-v1.json"),
    "utf8",
  ),
);
const legacyRoutes = JSON.parse(
  await readFile(
    path.join(projectRoot, "docs/audit/generated/legacy-routes.json"),
    "utf8",
  ),
);
const vercel = JSON.parse(
  await readFile(path.join(projectRoot, "vercel.json"), "utf8"),
);

const failures = [];
const rendered = new Set(manifest.renderedRoutes);
const redirects = new Map(
  manifest.redirects.map(({ source, destination }) => [source, destination]),
);
for (const { route } of legacyRoutes)
  if (!rendered.has(route) && !redirects.has(route))
    failures.push(`${route}: not rendered or redirected`);

const sources = new Set();
for (const { source, destination, permanent } of manifest.redirects) {
  if (sources.has(source))
    failures.push(`${source}: duplicate redirect source`);
  sources.add(source);
  if (!destination.startsWith("/"))
    failures.push(`${source}: redirect destination must be same-origin`);
  if (source === destination) failures.push(`${source}: redirect loop`);
  if (permanent !== true) failures.push(`${source}: redirect is not permanent`);
  if (redirects.has(destination))
    failures.push(`${source}: redirect chain through ${destination}`);
}

if (JSON.stringify(vercel.redirects) !== JSON.stringify(manifest.redirects))
  failures.push("vercel.json redirects differ from auxiliary URL manifest");

async function exists(file) {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

if (process.argv.includes("--check-dist")) {
  const staticRoutes = ["/archives/", "/categories/", "/tags/", "/movies/"];
  for (const route of staticRoutes) {
    const target = path.join(projectRoot, "dist", route, "index.html");
    if (!(await exists(target)))
      failures.push(`${route}: static output missing`);
  }
}

if (failures.length) {
  console.error(
    `Auxiliary URL validation failed with ${failures.length} error(s):`,
  );
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Auxiliary URL compatibility valid: ${legacyRoutes.length}/${legacyRoutes.length} captured routes covered; ${manifest.renderedRoutes.length} render directly and ${manifest.redirects.length} use single-hop permanent redirects.`,
);
