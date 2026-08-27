#!/usr/bin/env node
/**
 * Read-only Phase 0 audit for the sibling legacy Hexo project.
 *
 * Usage:
 *   node scripts/audit-legacy.mjs [--legacy /absolute/or/relative/path]
 *
 * Outputs versioned evidence to docs/audit/generated/. It does not modify the
 * legacy project and intentionally avoids inspecting node_modules.
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const projectRoot = path.resolve(import.meta.dirname, "..");
const defaultLegacy = "/Users/otis/Documents/hexoblog/blog";
const argumentIndex = process.argv.indexOf("--legacy");
const legacyRoot = path.resolve(
  argumentIndex >= 0 ? (process.argv[argumentIndex + 1] ?? "") : defaultLegacy,
);
const sourceRoot = path.join(legacyRoot, "source");
const publicRoot = path.join(legacyRoot, "public");
const auditRoot = path.join(projectRoot, "docs", "audit", "generated");
const siteOrigin = "https://imouyang.com";

if (!existsSync(sourceRoot) || !existsSync(publicRoot)) {
  console.error(
    `Legacy source/public directories not found under: ${legacyRoot}`,
  );
  process.exit(1);
}

const slash = (value) => value.split(path.sep).join("/");
const sha256 = (value) => createHash("sha256").update(value).digest("hex");
const relative = (root, target) => slash(path.relative(root, target));
const toPosixPath = (value) => value.replaceAll("\\", "/");
const escapeCsv = (value) => `"${String(value ?? "").replaceAll('"', '""')}"`;

async function walk(root, predicate = () => true) {
  const files = [];
  async function visit(current) {
    const entries = await readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === ".DS_Store") continue;
      const target = path.join(current, entry.name);
      if (entry.isDirectory()) await visit(target);
      else if (entry.isFile() && predicate(target)) files.push(target);
    }
  }
  await visit(root);
  return files.sort((a, b) => a.localeCompare(b, "zh-Hans-CN"));
}

function parseFrontMatter(raw) {
  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
  if (!match) return { raw: null, body: raw, fields: {} };
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (field) fields[field[1]] = field[2].trim();
  }
  return { raw: match[1], body: raw.slice(match[0].length), fields };
}

function extractUrls(text) {
  const values = new Set();
  for (const match of text.matchAll(/(?:https?:)?\/\/[^\s<>"')\]}]+/g))
    values.add(match[0]);
  return [...values].sort();
}

function extractLocalAssetRefs(text) {
  const refs = new Set();
  for (const match of text.matchAll(
    /(?:!\[[^\]]*\]\(|<img\b[^>]*?\bsrc=["']|(?:src|href|background-image)\s*[:=]\s*["']?)([^\s"')>]+)/gi,
  )) {
    const candidate = match[1].trim();
    if (
      candidate.startsWith("/images/") ||
      candidate.startsWith("../images/") ||
      candidate.startsWith("./images/")
    )
      refs.add(candidate);
  }
  return [...refs].sort();
}

function extractHtmlFeatures(text) {
  const found = new Set();
  for (const tag of [
    "iframe",
    "script",
    "style",
    "div",
    "img",
    "table",
    "details",
    "video",
    "audio",
    "svg",
  ]) {
    if (new RegExp(`<${tag}\\b`, "i").test(text)) found.add(tag);
  }
  if (/<!--\s*more\s*-->/i.test(text)) found.add("hexo-more-marker");
  if (/\{\{%|\}\}|\{\{/.test(text)) found.add("template-syntax");
  return [...found].sort();
}

function htmlDecode(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function readMeta(html, attribute, key) {
  const pattern = new RegExp(
    `<meta\\s+[^>]*${attribute}=["']${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`,
    "ig",
  );
  for (const tag of html.match(pattern) ?? []) {
    const content = tag.match(/\bcontent=["']([^"']*)["']/i)?.[1];
    if (content !== undefined) return htmlDecode(content);
  }
  return "";
}

function readCanonical(html) {
  const tag =
    html.match(/<link\s+[^>]*\brel=["']canonical["'][^>]*>/i)?.[0] ??
    html.match(
      /<link\s+[^>]*\bhref=["'][^"']+["'][^>]*\brel=["']canonical["'][^>]*>/i,
    )?.[0];
  return tag?.match(/\bhref=["']([^"']+)["']/i)?.[1] ?? "";
}

function normalizeTitle(value) {
  return value
    .replace(/\s*\|\s*小法进阶\s*$/u, "")
    .replace(/[‘’`]/g, "'")
    .replace(/^["']|["']$/g, "")
    .trim();
}

function publicationDate(html) {
  return html.match(/发布日期:[\s\S]{0,240}?(\d{4}-\d{2}-\d{2})/u)?.[1] ?? "";
}

function normalizeRoute(route) {
  if (!route || route === ".") return "/";
  const prefixed = route.startsWith("/") ? route : `/${route}`;
  return prefixed.endsWith("/") ? prefixed : `${prefixed}/`;
}

function routeFromCanonical(canonical, fallback) {
  if (!canonical) return normalizeRoute(fallback);
  try {
    const parsed = new URL(canonical, siteOrigin);
    return normalizeRoute(decodeURIComponent(parsed.pathname));
  } catch {
    return normalizeRoute(fallback);
  }
}

function routeFromPublicFile(file) {
  const fileName = path.basename(file);
  if (fileName.toLowerCase() === "index.html") {
    const folder = relative(publicRoot, path.dirname(file));
    return folder === "." ? "/" : normalizeRoute(folder);
  }
  return `/${relative(publicRoot, file)}`;
}

function stripTags(value) {
  return htmlDecode(
    value
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

async function writeJson(name, payload) {
  await writeFile(
    path.join(auditRoot, name),
    `${JSON.stringify(payload, null, 2)}\n`,
    "utf8",
  );
}

async function main() {
  await mkdir(auditRoot, { recursive: true });

  const markdownFiles = await walk(sourceRoot, (file) =>
    /\.md(?:own)?$/i.test(file),
  );
  const sourceFiles = await walk(sourceRoot);
  const publicFiles = await walk(publicRoot);
  const publicInventory = [];
  for (const file of publicFiles) {
    const info = await stat(file);
    const contents = await readFile(file);
    publicInventory.push({
      path: relative(legacyRoot, file),
      bytes: info.size,
      sha256: sha256(contents),
    });
  }
  // Some legacy permalinks (for example /cclisence) are HTML files without an
  // .html extension, so file names alone cannot identify every generated page.
  const publicHtml = [];
  for (const file of publicFiles) {
    const contents = await readFile(file, "utf8").catch(() => "");
    if (/^\s*<!doctype html|^\s*<html\b/i.test(contents)) publicHtml.push(file);
  }
  const sourceInventory = [];
  for (const file of sourceFiles) {
    const info = await stat(file);
    const contents = await readFile(file);
    sourceInventory.push({
      path: relative(legacyRoot, file),
      bytes: info.size,
      sha256: sha256(contents),
    });
  }

  const posts = [];
  const drafts = [];
  const pages = [];
  for (const file of markdownFiles) {
    const raw = await readFile(file, "utf8");
    const parsed = parseFrontMatter(raw);
    const entry = {
      source: relative(legacyRoot, file),
      title: parsed.fields.title ?? "",
      date: parsed.fields.date ?? "",
      fields: parsed.fields,
      hasFrontMatter: Boolean(parsed.raw),
      bytes: Buffer.byteLength(raw),
      sha256: sha256(raw),
      localAssetRefs: extractLocalAssetRefs(raw),
      externalUrls: extractUrls(raw),
      features: extractHtmlFeatures(raw),
    };
    const rel = relative(sourceRoot, file);
    if (rel.startsWith("_posts/")) posts.push(entry);
    else if (rel.startsWith("_drafts/")) drafts.push(entry);
    else pages.push(entry);
  }

  const routes = [];
  for (const file of publicHtml) {
    const html = await readFile(file, "utf8");
    const fallbackPath = routeFromPublicFile(file);
    const canonical = readCanonical(html);
    const route = routeFromCanonical(canonical, fallbackPath);
    routes.push({
      route,
      publicFile: relative(legacyRoot, file),
      canonical: canonical || null,
      title: stripTags(
        html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "",
      ),
      publishedDate: publicationDate(html),
      description: readMeta(html, "name", "description"),
      ogUrl: readMeta(html, "property", "og:url"),
      fallbackRoute: fallbackPath,
    });
  }
  routes.sort((a, b) => a.route.localeCompare(b.route, "zh-Hans-CN"));

  const routeByCanonical = new Map();
  for (const route of routes) {
    if (!routeByCanonical.has(route.route))
      routeByCanonical.set(route.route, []);
    routeByCanonical.get(route.route).push(route);
  }
  const duplicateRoutes = [...routeByCanonical.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([route, entries]) => ({
      route,
      publicFiles: entries.map((entry) => entry.publicFile),
    }));

  // Match article source against generated pages by explicit legacy permalink,
  // then title + published date; ambiguous cases remain visible for review.
  const routesByTitle = new Map();
  for (const route of routes) {
    const normalizedTitle = normalizeTitle(route.title);
    if (!normalizedTitle) continue;
    if (!routesByTitle.has(normalizedTitle))
      routesByTitle.set(normalizedTitle, []);
    routesByTitle.get(normalizedTitle).push(route);
  }
  const articleManifest = posts.map((post) => {
    const explicitPermalink = (post.fields.permalink ?? "")
      .replace(/^['"]|['"]$/g, "")
      .trim();
    const candidates = routesByTitle.get(normalizeTitle(post.title)) ?? [];
    const articleCandidates = candidates.filter(
      (candidate) =>
        ![
          "/",
          "/about/",
          "/archives/",
          "/categories/",
          "/tags/",
          "/timeline/",
          "/PGP/",
          "/books/",
          "/movies/",
        ].includes(candidate.route),
    );
    const dateCandidates = articleCandidates.filter(
      (candidate) => candidate.publishedDate === post.date.slice(0, 10),
    );
    const explicitCandidate = explicitPermalink
      ? routes.find(
          (candidate) =>
            candidate.route === `/${explicitPermalink}` ||
            candidate.route === `/${explicitPermalink}/`,
        )
      : null;
    const matched =
      explicitCandidate ??
      (dateCandidates.length === 1
        ? dateCandidates[0]
        : articleCandidates.length === 1
          ? articleCandidates[0]
          : null);
    return {
      source: post.source,
      title: post.title,
      date: post.date,
      legacyPath: matched?.route ?? null,
      status: matched
        ? explicitCandidate
          ? "matched-by-permalink"
          : "matched-by-title-and-date"
        : articleCandidates.length
          ? "ambiguous-title"
          : "unmatched",
      candidatePaths: articleCandidates.map((candidate) => candidate.route),
      sourceFields: post.fields,
    };
  });

  const imageFiles = sourceFiles.filter((file) =>
    relative(sourceRoot, file).startsWith("images/"),
  );
  const assetInventory = [];
  for (const file of imageFiles) {
    const contents = await readFile(file);
    const info = await stat(file);
    assetInventory.push({
      path: `/${relative(sourceRoot, file)}`,
      bytes: info.size,
      sha256: sha256(contents),
      extension: path.extname(file).toLowerCase() || null,
    });
  }

  const internalAssetPaths = new Set(assetInventory.map((asset) => asset.path));
  const assetReferences = [...posts, ...drafts, ...pages].flatMap((entry) =>
    entry.localAssetRefs.map((ref) => ({ source: entry.source, ref })),
  );
  const publicAssetPaths = new Set(
    publicFiles
      .map((file) => `/${relative(publicRoot, file)}`)
      .filter((file) => file.startsWith("/images/")),
  );
  const missingLocalAssets = assetReferences
    .map(({ source, ref }) => {
      const withoutQuery = ref.split(/[?#]/)[0];
      const decoded = decodeURIComponent(withoutQuery);
      const resolved = decoded.startsWith("/")
        ? decoded
        : `/${toPosixPath(path.normalize(path.join(path.dirname(source.replace(/^source\//, "")), decoded)))}`;
      return {
        source,
        ref,
        resolved,
        presentInLegacySource: internalAssetPaths.has(resolved),
        presentInLegacyPublic: publicAssetPaths.has(resolved),
      };
    })
    .filter(({ presentInLegacySource }) => !presentInLegacySource);

  const externalHosts = new Map();
  for (const entry of [...posts, ...drafts, ...pages]) {
    for (const url of entry.externalUrls) {
      try {
        const normalized = url.startsWith("//") ? `https:${url}` : url;
        const host = new URL(normalized).host;
        if (!externalHosts.has(host))
          externalHosts.set(host, { host, references: 0, sources: new Set() });
        const item = externalHosts.get(host);
        item.references += 1;
        item.sources.add(entry.source);
      } catch {
        /* malformed legacy URL: retained in source-level report */
      }
    }
  }

  const sitemapPath = path.join(publicRoot, "sitemap.xml");
  const sitemap = existsSync(sitemapPath)
    ? await readFile(sitemapPath, "utf8")
    : "";
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (match) => match[1],
  );

  const report = {
    generatedAt: new Date().toISOString(),
    legacyRoot,
    sourceFiles: sourceFiles.length,
    publicFiles: publicFiles.length,
    publicHtmlRoutes: routes.length,
    publishedPosts: posts.length,
    drafts: drafts.length,
    standaloneMarkdownPages: pages.length,
    imageAssets: assetInventory.length,
    sitemapUrls: sitemapUrls.length,
    duplicateGeneratedRoutes: duplicateRoutes.length,
    postRouteMapping: {
      matched: articleManifest.filter((entry) =>
        entry.status.startsWith("matched-"),
      ).length,
      unmatched: articleManifest.filter((entry) => entry.status === "unmatched")
        .length,
      ambiguous: articleManifest.filter(
        (entry) => entry.status === "ambiguous-title",
      ).length,
    },
    localAssetReferences: assetReferences.length,
    missingAbsoluteLocalAssetReferences: missingLocalAssets.length,
    missingAssetsPresentInLegacyPublic: missingLocalAssets.filter(
      (asset) => asset.presentInLegacyPublic,
    ).length,
    missingAssetsAbsentFromLegacyPublic: missingLocalAssets.filter(
      (asset) => !asset.presentInLegacyPublic,
    ).length,
    markdownFeatures: Object.fromEntries(
      [
        ...new Set(
          [...posts, ...drafts, ...pages].flatMap((entry) => entry.features),
        ),
      ]
        .sort()
        .map((feature) => [
          feature,
          [...posts, ...drafts, ...pages].filter((entry) =>
            entry.features.includes(feature),
          ).length,
        ]),
    ),
  };

  await writeJson("legacy-source-inventory.json", sourceInventory);
  await writeJson("legacy-public-inventory.json", publicInventory);
  await writeJson("legacy-routes.json", routes);
  await writeJson("legacy-route-duplicates.json", duplicateRoutes);
  await writeJson("url-manifest-draft.json", articleManifest);
  await writeJson("markdown-inventory.json", { posts, drafts, pages });
  await writeJson("asset-inventory.json", assetInventory);
  await writeJson("asset-reference-report.json", {
    references: assetReferences,
    missingAbsoluteReferences: missingLocalAssets,
  });
  await writeJson(
    "external-host-report.json",
    [...externalHosts.values()]
      .map((item) => ({ ...item, sources: [...item.sources].sort() }))
      .sort(
        (a, b) => b.references - a.references || a.host.localeCompare(b.host),
      ),
  );
  await writeJson("sitemap-urls.json", sitemapUrls);
  await writeJson("phase-0-summary.json", report);

  const csv = [
    ["source", "title", "date", "legacyPath", "status", "candidatePaths"],
    ...articleManifest.map((entry) => [
      entry.source,
      entry.title,
      entry.date,
      entry.legacyPath ?? "",
      entry.status,
      entry.candidatePaths.join(" | "),
    ]),
  ]
    .map((row) => row.map(escapeCsv).join(","))
    .join("\n");
  await writeFile(
    path.join(auditRoot, "url-manifest-draft.csv"),
    `${csv}\n`,
    "utf8",
  );

  console.log(JSON.stringify(report, null, 2));
  if (
    report.postRouteMapping.unmatched ||
    report.postRouteMapping.ambiguous ||
    report.missingAbsoluteLocalAssetReferences ||
    report.duplicateGeneratedRoutes
  ) {
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
