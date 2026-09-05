export type MovieMedia = {
  traktId: number;
  title: string;
  originalTitle: string | null;
  canonicalTitle?: string | null;
  year: number | null;
  posterRemote?: string;
  posterLocal?: string;
  url: string | null;
  lastWatchedAt: string;
};

export type MovieHistoryEntry = {
  id: number;
  watchedAt: string;
  type: "movie" | "episode";
  media: Omit<MovieMedia, "lastWatchedAt">;
  episode?: {
    title: string;
    canonicalTitle?: string | null;
    season: number | null;
    number: number | null;
  };
};

export type MovieSnapshot = {
  counts: { history: number; movies: number; shows: number };
  movies: MovieMedia[];
  shows: MovieMedia[];
  history: MovieHistoryEntry[];
};

export type MediaCardItem = {
  id: string;
  title: string;
  subtitle: string;
  secondaryTitle?: string | null;
  posterSrc?: string | null;
  href?: string | null;
};

function posterSource(item: Pick<MovieMedia, "posterRemote" | "posterLocal">) {
  return item.posterRemote ?? item.posterLocal ?? null;
}

function secondaryTitle(item: Pick<MovieMedia, "originalTitle" | "title">) {
  return item.originalTitle && item.originalTitle !== item.title
    ? item.originalTitle
    : null;
}

export function collectionMediaCards(media: MovieMedia[]): MediaCardItem[] {
  return media.map((item) => ({
    id: `media-${item.traktId}`,
    title: item.title,
    subtitle: item.year ? String(item.year) : "年份未记",
    secondaryTitle: secondaryTitle(item),
    posterSrc: posterSource(item),
    href: item.url,
  }));
}
