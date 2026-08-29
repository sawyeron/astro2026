#!/usr/bin/env node
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const contentRoot = path.join(root, "src/content/blog");
const publicRoot = path.join(root, "public");
const reportPath = path.join(
  root,
  "docs/audit/external-link-image-report.json",
);
const assetRegister = JSON.parse(
  await readFile(
    path.join(root, "docs/audit/asset-recovery-register.json"),
    "utf8",
  ),
);
const files = (await readdir(contentRoot)).filter((file) =>
  file.endsWith(".md"),
);
const links = [];
const images = [];
const allPublicImages = [];
const missingImages = [];
const imageReferences = new Map();
const linkReferences = new Map();

function lineNumber(text, index) {
  return text.slice(0, index).split("\n").length;
}

function classifyLink(url) {
  const parsed = new URL(url);
  if (parsed.protocol === "http:") return "legacy-http";
  if (parsed.hostname === "web.archive.org") return "web-archive";
  return "https";
}

function publicImagePath(source) {
  const pathname = decodeURIComponent(source.split("?")[0]);
  return path.join(publicRoot, pathname.replace(/^\//, ""));
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory() ? walk(target) : [target];
    }),
  );
  return nested.flat();
}

for (const file of files) {
  const relativeFile = `src/content/blog/${file}`;
  const text = await readFile(path.join(contentRoot, file), "utf8");
  for (const match of text.matchAll(/https?:\/\/[^\s<>"')\]]+/g)) {
    const url = match[0].replace(/[.,;:!?，。；：！？]+$/, "");
    const key = `${relativeFile}:${url}`;
    if (linkReferences.has(key)) continue;
    linkReferences.set(key, true);
    links.push({
      file: relativeFile,
      line: lineNumber(text, match.index),
      url,
      classification: classifyLink(url),
    });
  }
  for (const match of text.matchAll(/!\[[^\]]*\]\(([^)\s]+)(?:\s+[^)]*)?\)/g)) {
    const source = match[1].replace(/^['"]|['"]$/g, "");
    if (!source.startsWith("/images/")) continue;
    const reference = {
      file: relativeFile,
      line: lineNumber(text, match.index),
      source,
    };
    const target = publicImagePath(source);
    try {
      const metadata = await stat(target);
      const existing = imageReferences.get(source) ?? {
        source,
        bytes: metadata.size,
        references: [],
      };
      existing.references.push({ file: relativeFile, line: reference.line });
      imageReferences.set(source, existing);
    } catch {
      missingImages.push(reference);
    }
  }
}

images.push(...imageReferences.values());
images.sort((a, b) => b.bytes - a.bytes || a.source.localeCompare(b.source));
for (const file of await walk(path.join(publicRoot, "images"))) {
  if (!/\.(?:png|jpe?g|gif|webp|avif|svg)$/i.test(file)) continue;
  allPublicImages.push({
    source: `/${path.relative(publicRoot, file).split(path.sep).join("/")}`,
    bytes: (await stat(file)).size,
  });
}
allPublicImages.sort(
  (a, b) => b.bytes - a.bytes || a.source.localeCompare(b.source),
);
links.sort(
  (a, b) =>
    a.classification.localeCompare(b.classification) ||
    a.url.localeCompare(b.url) ||
    a.file.localeCompare(b.file),
);
missingImages.sort(
  (a, b) => a.source.localeCompare(b.source) || a.file.localeCompare(b.file),
);

const counts = {
  articles: files.length,
  externalLinkReferences: links.length,
  uniqueExternalUrls: new Set(links.map((link) => link.url)).size,
  legacyHttpReferences: links.filter(
    (link) => link.classification === "legacy-http",
  ).length,
  webArchiveReferences: links.filter(
    (link) => link.classification === "web-archive",
  ).length,
  localImageFilesReferenced: images.length,
  missingLocalImageReferences: missingImages.length,
  imagesOverOneMegabyte: allPublicImages.filter(
    (image) => image.bytes > 1_000_000,
  ).length,
  unresolvedHistoricalAssets: assetRegister.assets.filter(
    (asset) => asset.decision === "unresolved",
  ).length,
};
const report = {
  schemaVersion: 1,
  scope:
    "Static investigation only; no external requests were made and historical article bodies were not changed.",
  counts,
  largestPublicImages: allPublicImages.slice(0, 20),
  largestReferencedImages: images.slice(0, 20),
  unresolvedHistoricalAssets: assetRegister.assets
    .filter((asset) => asset.decision === "unresolved")
    .map(({ legacyPath, sourcePost, status }) => ({
      legacyPath,
      sourcePost,
      status,
    })),
  missingImages,
  links,
};
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log(
  `External link and image inventory generated: ${counts.externalLinkReferences} link reference(s), ${counts.legacyHttpReferences} legacy HTTP reference(s), ${counts.localImageFilesReferenced} referenced local image(s), ${counts.missingLocalImageReferences} missing local image reference(s), ${counts.imagesOverOneMegabyte} public image(s) over 1 MB, and ${counts.unresolvedHistoricalAssets} unresolved historical asset(s) represented by placeholders.`,
);
