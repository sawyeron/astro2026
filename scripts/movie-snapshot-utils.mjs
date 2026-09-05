// Trakt movie and show IDs belong to separate namespaces.
export function mediaIndex(snapshot) {
  return new Map([
    ...(snapshot.movies ?? []).map((item) => [`movie:${item.traktId}`, item]),
    ...(snapshot.shows ?? []).map((item) => [`show:${item.traktId}`, item]),
  ]);
}
export function mergeHistoryMedia(snapshot) {
  const index = mediaIndex(snapshot);
  for (const entry of snapshot.history) {
    const item = index.get(
      `${entry.type === "movie" ? "movie" : "show"}:${entry.media.traktId}`,
    );
    if (item) entry.media = { ...entry.media, ...item };
  }
}
export function preservePosters(snapshot, previous) {
  const prior = mediaIndex(previous);
  for (const [key, item] of mediaIndex(snapshot)) {
    const old = prior.get(key);
    for (const field of ["posterLocal", "posterRemote"])
      if (!item[field] && old?.[field]) item[field] = old[field];
  }
  mergeHistoryMedia(snapshot);
}
