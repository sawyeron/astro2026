import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import path from "node:path";
import { preservePosters } from "./movie-snapshot-utils.mjs";
const root = path.resolve(import.meta.dirname, "..");
const snapshot = JSON.parse(
  await readFile(path.join(root, "src/data/trakt-public-history.json"), "utf8"),
);
const previous = {
  movies: [
    {
      traktId: 1,
      posterLocal: "/movie.jpg",
      posterRemote: "https://example.org/movie.jpg",
    },
  ],
  shows: [{ traktId: 1, posterLocal: "/show.jpg" }],
};
const next = {
  movies: [{ traktId: 1 }],
  shows: [{ traktId: 1 }],
  history: [
    { type: "movie", media: { traktId: 1 } },
    { type: "episode", media: { traktId: 1 } },
  ],
};
preservePosters(next, previous);
assert.equal(next.history[0].media.posterLocal, "/movie.jpg");
assert.equal(next.history[1].media.posterLocal, "/show.jpg");
assert.equal(next.movies[0].posterRemote, previous.movies[0].posterRemote);
const ids = new Set(snapshot.history.map((e) => e.id));
assert.equal(ids.size, snapshot.history.length, "Duplicate history IDs");
assert.equal(snapshot.counts.history, snapshot.history.length);
let local = 0,
  remote = 0;
const missing = [];
for (const item of [...snapshot.movies, ...snapshot.shows]) {
  if (item.posterLocal) {
    assert.ok(
      item.posterLocal.startsWith("/movies/"),
      "Unexpected local poster path",
    );
    const target = path.resolve(root, "public", `.${item.posterLocal}`);
    assert.ok(
      target.startsWith(path.join(root, "public", "movies") + path.sep),
    );
    await access(target);
    local++;
  }
  if (item.posterRemote) {
    const u = new URL(item.posterRemote);
    assert.equal(u.protocol, "https:");
    assert.equal(
      u.hostname,
      "fzzapi.imouyang.com",
      "Review and allowlist any new CDN before switching",
    );
    assert.equal(u.search, "");
    remote++;
  }
  if (!item.posterRemote && !item.posterLocal) missing.push(item.title);
}
console.log(
  JSON.stringify(
    {
      history: snapshot.history.length,
      local,
      remote,
      missing,
      namespaceCollisionTest: "passed",
    },
    null,
    2,
  ),
);
