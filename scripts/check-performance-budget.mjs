#!/usr/bin/env node
import { readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const failures = [];
const warnings = [];
const limits = {
  totalAstroBytes: 350_000,
  largestAstroBytes: 180_000,
  largestImageBytes: 6_500_000,
  totalJavaScriptBytes: 500_000,
  totalFirstPartyJavaScriptBytes: 20_000,
};

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) => {
        const target = path.join(directory, entry.name);
        return entry.isDirectory() ? walk(target) : [target];
      }),
    )
  ).flat();
}

const files = await walk(dist);
const records = await Promise.all(
  files.map(async (file) => ({
    file,
    relative: path.relative(dist, file),
    bytes: (await stat(file)).size,
  })),
);
const astro = records.filter((record) => record.relative.startsWith("_astro/"));
const js = records.filter((record) => record.relative.endsWith(".js"));
const firstPartyJs = js.filter(
  (record) => !record.relative.startsWith("pagefind/"),
);
const images = records.filter((record) =>
  /\.(?:png|jpe?g|gif|webp|avif|svg)$/i.test(record.relative),
);
const sum = (items) => items.reduce((total, item) => total + item.bytes, 0);
const largest = (items) => [...items].sort((a, b) => b.bytes - a.bytes)[0];
const metrics = {
  totalBuildBytes: sum(records),
  totalAstroBytes: sum(astro),
  largestAstroAsset: largest(astro) ?? null,
  totalJavaScriptBytes: sum(js),
  totalFirstPartyJavaScriptBytes: sum(firstPartyJs),
  largestImage: largest(images) ?? null,
  imageCount: images.length,
};

if (metrics.totalAstroBytes > limits.totalAstroBytes)
  failures.push(
    `_astro assets exceed ${limits.totalAstroBytes} bytes: ${metrics.totalAstroBytes}`,
  );
if (metrics.largestAstroAsset?.bytes > limits.largestAstroBytes)
  failures.push(
    `largest _astro asset exceeds ${limits.largestAstroBytes} bytes: ${metrics.largestAstroAsset.relative} (${metrics.largestAstroAsset.bytes})`,
  );
if (metrics.totalJavaScriptBytes > limits.totalJavaScriptBytes)
  failures.push(
    `all JavaScript exceeds ${limits.totalJavaScriptBytes} bytes: ${metrics.totalJavaScriptBytes}`,
  );
if (
  metrics.totalFirstPartyJavaScriptBytes > limits.totalFirstPartyJavaScriptBytes
)
  failures.push(
    `first-party JavaScript exceeds ${limits.totalFirstPartyJavaScriptBytes} bytes: ${metrics.totalFirstPartyJavaScriptBytes}`,
  );
if (metrics.largestImage?.bytes > limits.largestImageBytes)
  failures.push(
    `largest image exceeds ${limits.largestImageBytes} bytes: ${metrics.largestImage.relative} (${metrics.largestImage.bytes})`,
  );
for (const image of images.filter((item) => item.bytes > 1_000_000))
  warnings.push(
    `${image.relative}: large historical image (${image.bytes} bytes)`,
  );

const report = {
  generatedAt: new Date().toISOString(),
  status: failures.length ? "failed" : "passed",
  limits,
  metrics,
  failures,
  warnings,
};
await writeFile(
  path.join(root, "docs/audit/performance-budget-report.json"),
  `${JSON.stringify(report, null, 2)}\n`,
);
if (failures.length) {
  console.error(`Performance budget failed with ${failures.length} error(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  `Performance budget valid: ${metrics.totalAstroBytes} bytes in _astro, ${metrics.totalFirstPartyJavaScriptBytes} bytes of first-party JavaScript, and ${metrics.totalJavaScriptBytes} bytes including the browser-local Pagefind search runtime.`,
);
for (const warning of warnings) console.warn(`Warning: ${warning}`);
