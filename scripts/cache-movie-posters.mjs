#!/usr/bin/env node
/**
 * Cache the legacy movie-poster originals for static, zero-runtime-request use.
 * The source URL remains in src/data/movies-legacy.json as provenance; this
 * script never rewrites historical data or its remote originals.
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const data = JSON.parse(
  await readFile(path.join(root, "src/data/movies-legacy.json"), "utf8"),
);
const posters = [...data.watched, ...data.watchlist]
  .map(({ image }) => image)
  .filter(Boolean);
const uniquePosters = [...new Set(posters)];
const outputDirectory = path.join(root, "public/movies/posters");
const concurrency = 8;
const force = process.argv.includes("--force");

await mkdir(outputDirectory, { recursive: true });
let completed = 0;
let downloaded = 0;
const failures = [];

async function cachePoster(url) {
  const filename = path.basename(new URL(url).pathname);
  const target = path.join(outputDirectory, filename);
  try {
    if (!force && (await stat(target)).size > 0) {
      completed += 1;
      return;
    }
  } catch {
    // File has not been cached yet.
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!response.ok)
      throw new Error(`received HTTP ${response.status} for ${url}`);
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/jpeg"))
      throw new Error(
        `expected JPEG, received ${contentType || "no content type"}`,
      );
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.length < 512)
      throw new Error(`received an implausibly small file`);
    await writeFile(target, bytes);
    downloaded += 1;
  } catch (error) {
    failures.push(`${url}: ${error instanceof Error ? error.message : error}`);
  } finally {
    completed += 1;
    process.stdout.write(
      `\rCaching posters: ${completed}/${uniquePosters.length}`,
    );
  }
}

for (let offset = 0; offset < uniquePosters.length; offset += concurrency)
  await Promise.all(
    uniquePosters.slice(offset, offset + concurrency).map(cachePoster),
  );
process.stdout.write("\n");

if (failures.length) {
  console.error(`Failed to cache ${failures.length} poster(s):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  `Movie posters ready: ${uniquePosters.length} local originals (${downloaded} downloaded, ${uniquePosters.length - downloaded} already cached).`,
);
