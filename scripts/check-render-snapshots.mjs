#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const manifest = JSON.parse(
  await readFile(
    path.join(root, "docs/audit/render-snapshot-manifest-v1.json"),
    "utf8",
  ),
);
const failures = [];

function visibleText(value) {
  return value
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(?:amp|lt|gt|quot|#39);/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

for (const snapshot of manifest.snapshots) {
  let html;
  try {
    html = await readFile(path.join(root, snapshot.output), "utf8");
  } catch {
    failures.push(`${snapshot.output}: output missing`);
    continue;
  }
  const articleMatch = html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i);
  if (!articleMatch) {
    failures.push(`${snapshot.output}: article element missing`);
    continue;
  }
  const article = articleMatch[1];
  if (!visibleText(article).includes(snapshot.expectations.articleTitle))
    failures.push(`${snapshot.output}: article title missing`);
  if (visibleText(article).length < 250)
    failures.push(
      `${snapshot.output}: rendered article content is unexpectedly short`,
    );
  if (snapshot.expectations.hasTable && !/<table\b/i.test(article))
    failures.push(`${snapshot.output}: table did not render`);
  if (
    snapshot.expectations.hasCodeBlock &&
    !/<pre\b[^>]*>[\s\S]*?<code\b/i.test(article)
  )
    failures.push(`${snapshot.output}: fenced code block did not render`);
  if (snapshot.expectations.hasFootnotes) {
    if (
      !/(class="footnotes"|data-footnotes|class="footnotes-area")/i.test(
        article,
      )
    )
      failures.push(`${snapshot.output}: footnotes did not render`);
    const noteTargets = [...article.matchAll(/id="dfref-footnote-(\d+)"/g)].map(
      (match) => match[1],
    );
    const referenceTargets = [
      ...article.matchAll(/id="ref-footnote-(\d+)"/g),
    ].map((match) => match[1]);
    for (const target of noteTargets)
      if (!article.includes(`href="#dfref-footnote-${target}"`))
        failures.push(
          `${snapshot.output}: footnote ${target} has no matching body reference`,
        );
    for (const target of referenceTargets)
      if (!article.includes(`href="#ref-footnote-${target}"`))
        failures.push(
          `${snapshot.output}: body reference ${target} has no footnote back-link`,
        );
    if (
      snapshot.source.includes("cetrain") &&
      (noteTargets.length !== 29 || referenceTargets.length !== 29)
    )
      failures.push(
        `${snapshot.output}: expected 29 bidirectional legacy footnotes`,
      );
  }
  if (snapshot.expectations.hasInlineSvg && !/<svg\b/i.test(article))
    failures.push(`${snapshot.output}: inline SVG did not render`);
  for (const marker of snapshot.expectations.rawHtmlMarkers ?? [])
    if (!article.includes(marker))
      failures.push(
        `${snapshot.output}: expected legacy HTML marker ${marker} missing`,
      );
  if (/\{%\s*|<!--\s*more\s*-->/i.test(article))
    failures.push(`${snapshot.output}: unconverted legacy syntax found`);
}

if (failures.length) {
  console.error(
    `Render snapshot validation failed with ${failures.length} error(s):`,
  );
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  `Render snapshots valid: ${manifest.snapshots.length} complex migrated articles passed structural checks.`,
);
