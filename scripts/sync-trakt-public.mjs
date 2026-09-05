#!/usr/bin/env node
/* global window, document */
/**
 * Mirror the history that a public Trakt profile visibly exposes in its web UI.
 *
 * This deliberately does not call Trakt's public API, provide an API key, use
 * cookies, or authenticate. Instead a clean browser session opens the public
 * History page and records the JSON responses that the page itself renders.
 * The resulting snapshot is replaced atomically only after every advertised
 * history page has been received and validated.
 */
import { mkdtemp, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "playwright";
import { preservePosters } from "./movie-snapshot-utils.mjs";

const root = path.resolve(import.meta.dirname, "..");
const username =
  process.argv.slice(2).find((argument) => !argument.startsWith("--")) ??
  "Otis4TK";
const output = path.join(root, "src/data/trakt-public-history.json");
const historyUrl = `https://app.trakt.tv/profile/${encodeURIComponent(username)}/history`;
const pageResponses = new Map();
const allowHistoryShrink = process.argv.includes("--allow-history-shrink");
const timeout = 20 * 60_000;

const asHttps = (value) =>
  typeof value === "string" && value
    ? value.startsWith("http")
      ? value
      : `https://${value.replace(/^\/+/, "")}`
    : null;
const hasHan = (value) => /[\u3400-\u9fff]/.test(value ?? "");
const preferredTitle = (media, fallback) => {
  const title = media?.title;
  const originalTitle = media?.original_title;
  // Trakt's public History response returns its canonical English title even
  // when the UI locale is Chinese. Its original title is the only public,
  // source-native Chinese metadata available without authenticated overlays.
  if (hasHan(originalTitle)) return originalTitle;
  if (hasHan(title)) return title;
  return title ?? originalTitle ?? fallback;
};
const firstImage = (media) => asHttps(media?.images?.poster?.[0]);
const publicMediaUrl = (kind, media) => {
  const slug = media?.ids?.slug;
  return slug ? `https://app.trakt.tv/${kind}s/${slug}` : null;
};

function normalizeItem(item) {
  const watchedAt = item?.watched_at;
  if (!item || typeof item.id !== "number" || typeof watchedAt !== "string")
    throw new Error("Trakt response includes an invalid history entry");

  if (item.type === "movie" && item.movie?.ids?.trakt) {
    return {
      id: item.id,
      watchedAt,
      type: "movie",
      media: {
        traktId: item.movie.ids.trakt,
        tmdbId: item.movie.ids.tmdb ?? null,
        slug: item.movie.ids.slug ?? null,
        title: preferredTitle(item.movie, "未命名电影"),
        canonicalTitle: item.movie.title ?? null,
        originalTitle: item.movie.original_title ?? null,
        year: item.movie.year ?? null,
        poster: firstImage(item.movie),
        url: publicMediaUrl("movie", item.movie),
      },
    };
  }

  if (
    item.type === "episode" &&
    item.episode?.ids?.trakt &&
    item.show?.ids?.trakt
  ) {
    return {
      id: item.id,
      watchedAt,
      type: "episode",
      episode: {
        traktId: item.episode.ids.trakt,
        title: preferredTitle(
          item.episode,
          `第 ${item.episode.number ?? "?"} 集`,
        ),
        canonicalTitle: item.episode.title ?? null,
        season: item.episode.season ?? null,
        number: item.episode.number ?? null,
      },
      media: {
        traktId: item.show.ids.trakt,
        tmdbId: item.show.ids.tmdb ?? null,
        slug: item.show.ids.slug ?? null,
        title: preferredTitle(item.show, "未命名剧集"),
        canonicalTitle: item.show.title ?? null,
        originalTitle: item.show.original_title ?? null,
        year: item.show.year ?? null,
        poster: firstImage(item.show),
        url: publicMediaUrl("show", item.show),
      },
    };
  }

  // The public history endpoint can add media types over time. Do not silently
  // discard a record: a schema change must leave the previous snapshot intact.
  throw new Error(`Unsupported public Trakt history item type: ${item.type}`);
}

function makeSnapshot(entries, pageCount) {
  const normalized = entries
    .map(normalizeItem)
    .sort((a, b) => b.watchedAt.localeCompare(a.watchedAt) || b.id - a.id);
  const uniqueIds = new Set(normalized.map((entry) => entry.id));
  if (uniqueIds.size !== normalized.length)
    throw new Error("Duplicate history IDs received from Trakt");

  const movies = new Map();
  const shows = new Map();
  for (const entry of normalized) {
    const collection = entry.type === "movie" ? movies : shows;
    const current = collection.get(entry.media.traktId);
    if (!current || entry.watchedAt > current.lastWatchedAt)
      collection.set(entry.media.traktId, {
        ...entry.media,
        lastWatchedAt: entry.watchedAt,
      });
  }

  return {
    schemaVersion: 1,
    source: {
      provider: "Trakt public profile History page",
      profile: `https://app.trakt.tv/profile/${username}`,
      history: historyUrl,
      access:
        "Unauthenticated browser rendering of publicly visible history only",
    },
    syncedAt: new Date().toISOString(),
    pageCount,
    counts: {
      history: normalized.length,
      movies: movies.size,
      shows: shows.size,
    },
    history: normalized,
    movies: [...movies.values()].sort((a, b) =>
      b.lastWatchedAt.localeCompare(a.lastWatchedAt),
    ),
    shows: [...shows.values()].sort((a, b) =>
      b.lastWatchedAt.localeCompare(a.lastWatchedAt),
    ),
  };
}

async function assertSnapshotIsNotUnexpectedlySmaller(snapshot) {
  try {
    const previous = JSON.parse(await readFile(output, "utf8"));
    const previousCount = previous?.counts?.history;
    if (
      !allowHistoryShrink &&
      Number.isInteger(previousCount) &&
      snapshot.counts.history < previousCount
    )
      throw new Error(
        `Refusing to replace ${previousCount}-event snapshot with smaller ${snapshot.counts.history}-event result. Re-run with --allow-history-shrink only after confirming intentional removals in Trakt.`,
      );
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
}

async function preserveExistingPosterReferences(snapshot) {
  try {
    const previous = JSON.parse(await readFile(output, "utf8"));
    preservePosters(snapshot, previous);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
}

const browser = await chromium.launch({ headless: true, channel: "chrome" });
try {
  const context = await browser.newContext({
    locale: "en-US",
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.on("response", async (response) => {
    const url = new URL(response.url());
    if (
      response.status() !== 200 ||
      url.hostname !== "apiz.trakt.tv" ||
      url.pathname !== `/users/${username}/history/`
    )
      return;
    const pageNumber = Number(url.searchParams.get("page"));
    if (!Number.isInteger(pageNumber) || pageNumber < 1) return;
    try {
      const body = await response.json();
      if (!Array.isArray(body))
        throw new Error("response body is not an array");
      const advertised = Number(response.headers()["x-pagination-page-count"]);
      if (!Number.isInteger(advertised) || advertised < 1)
        throw new Error("missing pagination metadata");
      pageResponses.set(pageNumber, { body, advertised });
    } catch (error) {
      console.error(
        `Unable to read public Trakt history page ${pageNumber}:`,
        error,
      );
    }
  });

  await page.goto(historyUrl, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  const resolvedPageCount = () => {
    // Trakt can report an old total on early responses, then mark the actual
    // final page by setting x-pagination-page-count to that page number.
    const terminal = [...pageResponses]
      .filter(([pageNumber, response]) => response.advertised === pageNumber)
      .map(([pageNumber]) => pageNumber);
    return terminal.length ? Math.max(...terminal) : null;
  };
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const pageCount = resolvedPageCount();
    if (
      pageCount &&
      Array.from({ length: pageCount }, (_, index) => index + 1).every(
        (pageNumber) => pageResponses.has(pageNumber),
      )
    )
      break;
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    await page.waitForTimeout(1_100);
  }

  const pageCount = resolvedPageCount();
  if (!pageCount)
    throw new Error(
      "The public History page did not expose a terminal pagination response",
    );
  const missing = Array.from(
    { length: pageCount },
    (_, index) => index + 1,
  ).filter((pageNumber) => !pageResponses.has(pageNumber));
  if (missing.length)
    throw new Error(
      `Incomplete public History mirror: missing page(s) ${missing.join(", ")}`,
    );

  const entries = Array.from(
    { length: pageCount },
    (_, index) => pageResponses.get(index + 1).body,
  ).flat();
  if (entries.length < 1) throw new Error("Public History contains no entries");
  const snapshot = makeSnapshot(entries, pageCount);
  await assertSnapshotIsNotUnexpectedlySmaller(snapshot);
  await preserveExistingPosterReferences(snapshot);
  const tempDirectory = await mkdtemp(
    path.join(path.dirname(output), ".trakt-sync-"),
  );
  const temporaryOutput = path.join(tempDirectory, "trakt-public-history.json");
  try {
    await writeFile(temporaryOutput, `${JSON.stringify(snapshot, null, 2)}\n`);
    await rename(temporaryOutput, output);
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
  console.log(
    `Trakt public history mirrored: ${snapshot.counts.history} events, ${snapshot.counts.movies} movies, ${snapshot.counts.shows} shows across ${pageCount} page(s).`,
  );
} finally {
  await browser.close();
}
