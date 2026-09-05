import test from "node:test";
import assert from "node:assert/strict";
import {
  planEnrichment,
  sameSnapshotContent,
} from "./movie-enrichment-plan.mjs";
const structuredClone = globalThis.structuredClone;
const remote = "https://fzzapi.imouyang.com/t/p/w342/example.jpg";
function fixture() {
  return {
    syncedAt: "before",
    movies: [{ traktId: 1, tmdbId: 10, title: "中文", posterRemote: remote }],
    shows: [
      {
        traktId: 1,
        tmdbId: 20,
        title: "剧集",
        posterLocal: "/movies/trakt-posters/show-1.webp",
      },
    ],
    history: [{ id: 1, type: "movie", media: { traktId: 1 } }],
  };
}
test("reuse remote title and local-only fallback across separate namespaces", () => {
  const old = fixture();
  const next = structuredClone(old);
  next.movies[0].title = "Transient title";
  assert.equal(planEnrichment(next, old).length, 0);
  assert.equal(next.movies[0].title, "中文");
  assert.equal(next.history[0].media.posterRemote, remote);
  assert.equal(next.shows[0].posterRemote, undefined);
});
test("new and missing artwork require enrichment", () => {
  const old = fixture();
  delete old.movies[0].posterRemote;
  const next = structuredClone(old);
  next.shows.push({ traktId: 2, tmdbId: 30 });
  assert.equal(planEnrichment(next, old).length, 2);
});
test("changed association clears inherited remote from media and history", () => {
  const old = fixture();
  const next = structuredClone(old);
  next.movies[0].tmdbId = 11;
  next.history[0].media.posterRemote = remote;
  assert.equal(planEnrichment(next, old).length, 1);
  assert.equal(next.movies[0].posterRemote, undefined);
  assert.equal(next.history[0].media.posterRemote, undefined);
});
test("untrusted remote URL is not reused", () => {
  const old = fixture();
  old.movies[0].posterRemote += "?api_key=not-a-real-key";
  assert.equal(planEnrichment(structuredClone(old), old).length, 1);
});
test("only timestamp differences are ignored; additions and deletions remain visible", () => {
  const old = fixture();
  const next = structuredClone(old);
  next.syncedAt = "after";
  assert.ok(sameSnapshotContent(old, next));
  next.history = [];
  assert.ok(!sameSnapshotContent(old, next));
  assert.equal(old.syncedAt, "before");
});
