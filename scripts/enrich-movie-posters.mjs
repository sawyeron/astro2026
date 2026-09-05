import { readFile, writeFile, rename, rm, copyFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import process from "node:process";
import { setTimeout } from "node:timers";
import { mergeHistoryMedia } from "./movie-snapshot-utils.mjs";
const root = path.resolve(import.meta.dirname, "..");
const output = path.join(root, "src/data/trakt-public-history.json");
const reportPath = path.join(os.tmpdir(), "astro2026-tmdb-coverage.json");
const key = process.env.TMDB_PROXY_API_KEY?.trim();
const base = process.env.TMDB_PROXY_BASE?.trim();
if (!key || base !== "https://fzzapi.imouyang.com")
  throw new Error(
    "Missing key or unexpected proxy base; stopped without modifying data",
  );
const original = await readFile(output, "utf8");
const snapshot = JSON.parse(original);
const backup = path.join(
  os.tmpdir(),
  `astro2026-trakt-before-tmdb-${Date.now()}.json`,
);
await copyFile(output, backup);
const tasks = [
  ...snapshot.movies.map((item) => ({ kind: "movie", item })),
  ...snapshot.shows.map((item) => ({ kind: "tv", item })),
];
const results = [];
let fatal = false;
async function request(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(30000),
        redirect: "error",
      });
      if (response.status === 401 || response.status === 403) {
        fatal = true;
        throw new Error("Authentication/access rejected");
      }
      if ((response.status === 429 || response.status >= 500) && attempt < 2) {
        await response.body?.cancel();
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
        continue;
      }
      return response;
    } catch {
      if (fatal || attempt === 2)
        throw new Error("Request failed (credentials redacted)");
    }
  }
  throw new Error("Request failed");
}
async function enrich({ kind, item }) {
  const result = {
    kind,
    traktId: item.traktId,
    tmdbId: item.tmdbId ?? null,
    title: item.title,
    status: "failed",
  };
  try {
    if (!Number.isInteger(item.tmdbId) || item.tmdbId < 1)
      throw new Error("Missing TMDB ID");
    const u = new URL(`${base}/3/${kind}/${item.tmdbId}`);
    u.searchParams.set("language", "zh-CN");
    u.searchParams.set("api_key", key);
    const meta = await request(u);
    if (!meta.ok) throw new Error(`Metadata HTTP ${meta.status}`);
    const detail = await meta.json();
    if (detail.id !== item.tmdbId) throw new Error("Metadata ID mismatch");
    if (
      typeof detail.poster_path !== "string" ||
      !/^\/[a-zA-Z0-9._-]+$/.test(detail.poster_path)
    )
      throw new Error("No valid poster path");
    const remote = `${base}/t/p/w342${detail.poster_path}`;
    const image = await request(remote);
    if (!image.ok) throw new Error(`Image HTTP ${image.status}`);
    const mime = image.headers.get("content-type") ?? "";
    const bytes = new Uint8Array(await image.arrayBuffer());
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const png =
      bytes[0] === 137 && bytes[1] === 80 && bytes[2] === 78 && bytes[3] === 71;
    const webp =
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (
      !mime.startsWith("image/") ||
      bytes.length < 100 ||
      !(jpeg || png || webp)
    )
      throw new Error("Invalid image response");
    item.posterRemote = remote;
    const title = kind === "movie" ? detail.title : detail.name;
    if (typeof title === "string" && title.trim()) item.title = title.trim();
    result.status = "verified";
    result.bytes = bytes.length;
  } catch (error) {
    result.reason = error.message;
  }
  results.push(result);
}
for (let i = 0; i < tasks.length && !fatal; i += 4) {
  await Promise.all(tasks.slice(i, i + 4).map(enrich));
  console.log(
    `Verified batch: ${Math.min(i + 4, tasks.length)}/${tasks.length}`,
  );
}
const report = {
  total: tasks.length,
  verified: results.filter((x) => x.status === "verified").length,
  failed: results.filter((x) => x.status !== "verified"),
  fatal,
  backup,
};
await writeFile(reportPath, JSON.stringify(report, null, 2) + "\n");
if (fatal || report.verified === 0)
  throw new Error(
    "Proxy enrichment aborted; snapshot retained. See redacted report.",
  );
mergeHistoryMedia(snapshot);
if ((await readFile(output, "utf8")) !== original)
  throw new Error("Snapshot changed concurrently; refusing overwrite");
const temp = `${output}.${process.pid}.tmp`;
try {
  await writeFile(temp, JSON.stringify(snapshot, null, 2) + "\n", {
    flag: "wx",
  });
  await rename(temp, output);
} finally {
  await rm(temp, { force: true });
}
console.log(JSON.stringify(report, null, 2));
