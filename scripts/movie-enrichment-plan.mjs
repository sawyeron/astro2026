import { mediaIndex, mergeHistoryMedia } from "./movie-snapshot-utils.mjs";
import { isDeepStrictEqual } from "node:util";

// Reuse only references from the trusted, previously committed snapshot.
export function planEnrichment(snapshot, previous) {
  const prior = mediaIndex(previous);
  const tasks = [];
  for (const [key, item] of mediaIndex(snapshot)) {
    const old = prior.get(key);
    const sameIdentity = old && old.tmdbId === item.tmdbId;
    const remote =
      sameIdentity &&
      typeof old.posterRemote === "string" &&
      /^https:\/\/fzzapi\.imouyang\.com\/t\/p\/w342\/[a-zA-Z0-9._-]+$/.test(
        old.posterRemote,
      );
    const local =
      sameIdentity &&
      typeof old.posterLocal === "string" &&
      /^\/movies\/trakt-posters\/[a-zA-Z0-9_-]+\.(webp|jpg|jpeg|png)$/.test(
        old.posterLocal,
      );
    if (remote || local) {
      if (remote) {
        item.posterRemote = old.posterRemote;
        // Preserve the approved localized title, not transient Trakt wording.
        if (old.title) item.title = old.title;
      }
      if (local) item.posterLocal = old.posterLocal;
    } else {
      // A changed TMDB association must not inherit the previous remote poster.
      if (old && !sameIdentity) {
        delete item.posterRemote;
        for (const entry of snapshot.history) {
          const entryKey = `${entry.type === "movie" ? "movie" : "show"}:${entry.media.traktId}`;
          if (entryKey === key) delete entry.media.posterRemote;
        }
      }
      tasks.push({ kind: key.startsWith("movie:") ? "movie" : "tv", item });
    }
  }
  mergeHistoryMedia(snapshot);
  return tasks;
}

export function sameSnapshotContent(before, after) {
  const left = { ...before };
  const right = { ...after };
  delete left.syncedAt;
  delete right.syncedAt;
  return isDeepStrictEqual(left, right);
}
