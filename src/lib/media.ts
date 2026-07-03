// Live entertainment signals with zero API keys, same zero-account doctrine
// as the OSM geo stack: Apple's iTunes RSS charts (CORS `*`, keyless) tell us
// what's actually topping TV and movie sales right now. A curated fallback
// keeps suggestions specific even offline or on first paint.
// (TVMaze schedules were tried and dropped: sparse weeks + daytime filler.)

export interface HotMedia {
  shows: string[];
  movies: string[];
  fetchedAt: number;
}

/** Ships in the bundle so day-one/offline suggestions still name real titles. */
export const FALLBACK_MEDIA: HotMedia = {
  shows: [
    'Stranger Things — the final season',
    'Wednesday — Season 2',
    'The Bear',
    'Slow Horses',
    'Severance',
    'The Diplomat',
  ],
  movies: [
    'Minions 3',
    'Toy Story 5',
    'Supergirl',
    'Moana — live action',
    'The Odyssey',
  ],
  fetchedAt: 0,
};

/** Chart entries → clean display titles (box-set suffixes trimmed). */
function chartNames(data: unknown): string[] {
  const entries: Array<{ 'im:name'?: { label?: string } }> =
    (data as { feed?: { entry?: [] } })?.feed?.entry ?? [];
  return entries
    .map((e) => e?.['im:name']?.label)
    .filter((n): n is string => !!n)
    .map((n) => n.replace(/[,:]?\s*The Complete Series$/i, '').trim());
}

/** The current top-selling TV seasons on the iTunes chart. */
export async function fetchHotShows(): Promise<string[]> {
  const res = await fetch('https://itunes.apple.com/us/rss/toptvseasons/limit=15/json');
  if (!res.ok) throw new Error(`iTunes TV ${res.status}`);
  const names = chartNames(await res.json());
  if (names.length === 0) throw new Error('iTunes TV chart empty');
  return names.slice(0, 8);
}

/** The current top-selling movies on the iTunes chart. */
export async function fetchTopMovies(): Promise<string[]> {
  const res = await fetch('https://itunes.apple.com/us/rss/topmovies/limit=15/json');
  if (!res.ok) throw new Error(`iTunes ${res.status}`);
  const names = chartNames(await res.json());
  if (names.length === 0) throw new Error('iTunes chart empty');
  return names.slice(0, 8);
}

/** Both feeds, each independently falling back to the curated list. */
export async function fetchHotMedia(): Promise<HotMedia> {
  const [shows, movies] = await Promise.all([
    fetchHotShows().catch(() => FALLBACK_MEDIA.shows),
    fetchTopMovies().catch(() => FALLBACK_MEDIA.movies),
  ]);
  return { shows, movies, fetchedAt: Date.now() };
}
