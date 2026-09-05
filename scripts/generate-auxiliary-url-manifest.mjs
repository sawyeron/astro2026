#!/usr/bin/env node
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { parse as parseYaml } from "yaml";

const projectRoot = path.resolve(import.meta.dirname, "..");
const legacyRoutesPath = path.join(
  projectRoot,
  "docs/audit/generated/legacy-routes.json",
);
const contentRoot = path.join(projectRoot, "src/content/blog");

function parseFrontMatter(text) {
  const match = text.match(/^---\s*\n([\s\S]*?)\n---/);
  return parseYaml(match?.[1] ?? "") ?? {};
}

const { readdir } = await import("node:fs/promises");
const contentFiles = (await readdir(contentRoot)).filter((name) =>
  name.endsWith(".md"),
);
const articlePaths = new Set();
const categories = new Set();
const tags = new Set();
for (const name of contentFiles) {
  const data = parseFrontMatter(
    await readFile(path.join(contentRoot, name), "utf8"),
  );
  if (data.legacyPath) articlePaths.add(data.legacyPath);
  for (const category of data.categories ?? [])
    categories.add(String(category));
  for (const tag of data.tags ?? []) tags.add(String(tag));
}

const legacyRoutes = JSON.parse(await readFile(legacyRoutesPath, "utf8"));
const redirects = new Map();
const rendered = new Set([
  "/",
  "/about/",
  "/PGP/",
  "/movies/",
  "/archives/",
  "/categories/",
  "/tags/",
  ...articlePaths,
  ...[...categories].map((value) => `/categories/${value}/`),
  ...[...tags].map((value) => `/tags/${value}/`),
]);

for (const { route } of legacyRoutes) {
  if (route === "/timeline/") {
    redirects.set(route, "/archives/");
    continue;
  }
  if (rendered.has(route)) continue;
  let destination;
  if (/^\/page\/\d+\/$/.test(route)) destination = "/archives/";
  else if (/^\/archives\//.test(route)) {
    const year = route.match(/^\/archives\/(\d{4})\//)?.[1];
    destination = year ? `/archives/?year=${year}` : "/archives/";
  } else if (/^\/categories\/.+\/page\/\d+\/$/.test(route)) {
    destination = route.replace(/page\/\d+\/$/, "");
  } else if (/^\/tags\/.+\/page\/\d+\/$/.test(route)) {
    destination = route.replace(/page\/\d+\/$/, "");
  } else if (route === "/tags/index-1.html/" || route === "/tags/index-1.html")
    destination = "/tags/";
  else if (route === "/books/") destination = "/archives/";
  else if (route === "/google3756ddc34336b7b9.html/")
    destination = "/google3756ddc34336b7b9.html";
  if (destination && destination !== route) redirects.set(route, destination);
}

const output = {
  schemaVersion: 1,
  generatedFrom: "docs/audit/generated/legacy-routes.json",
  renderedRoutes: [...rendered].sort(),
  redirects: [...redirects]
    .map(([source, destination]) => ({ source, destination, permanent: true }))
    .sort((a, b) => a.source.localeCompare(b.source)),
};
await writeFile(
  path.join(projectRoot, "docs/audit/auxiliary-url-manifest-v1.json"),
  `${JSON.stringify(output, null, 2)}\n`,
);

const vercelPath = path.join(projectRoot, "vercel.json");
const vercel = JSON.parse(await readFile(vercelPath, "utf8"));
vercel.redirects = output.redirects;
await writeFile(vercelPath, `${JSON.stringify(vercel, null, 2)}\n`);

const covered = new Set([...rendered, ...redirects.keys()]);
const uncovered = legacyRoutes
  .map(({ route }) => route)
  .filter((route) => !covered.has(route));
if (uncovered.length) {
  console.error(`Uncovered legacy routes: ${uncovered.length}`);
  for (const route of uncovered) console.error(`- ${route}`);
  process.exitCode = 1;
} else {
  console.log(
    `Auxiliary URL manifest generated: ${rendered.size} rendered, ${redirects.size} redirected, ${legacyRoutes.length}/${legacyRoutes.length} legacy routes covered.`,
  );
}
