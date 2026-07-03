// On-device app store (React context) with AsyncStorage persistence. The engine
// stays pure; this file owns state transitions so a future backend can replace it
// behind the same interface.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchNearbyPlaces, GEO_CATEGORIES, getCurrentPosition, reverseCity, type NearbyPlace } from '../lib/geo';
import { applyOutcome, voterWeight } from './sage';
import { parseIcs, type CalEvent } from './schedule';
import { ME, seedNests, seedSurvs, seedUsers } from './seed';
import type {
  Audience,
  Category,
  ClosenessTier,
  Nest,
  Outcome,
  Surv,
  SurvOption,
  User,
} from './types';

const STORAGE_KEY = 'surv.state.v1';

export interface GeoState {
  lat: number;
  lon: number;
  city: string | null;
  updatedAt: number;
}

interface PersistedState {
  users: User[];
  nests: Nest[];
  survs: Surv[];
  calendarEvents?: CalEvent[];
  geo?: GeoState | null;
  nearbyPlaces?: Partial<Record<Category, NearbyPlace[]>>;
}

interface SurvStore {
  me: User;
  users: User[];
  nests: Nest[];
  survs: Surv[];
  calendarEvents: CalEvent[];
  geo: GeoState | null;
  nearbyPlaces: Partial<Record<Category, NearbyPlace[]>>;
  hydrated: boolean;
  userById: (id: string) => User | undefined;
  /** GPS → city + real nearby places per category; suggestions become geolocated. */
  requestLocation: () => Promise<boolean>;
  /** Paste .ics text (Google Calendar / iCal export) → events feed the drafts engine. */
  importCalendar: (icsText: string) => number;
  setMyName: (name: string) => void;
  importSurv: (packet: { surv: Omit<Surv, 'votes' | 'comments'>; askerName: string }) => Surv | null;
  importVote: (packet: { survId: string; optionId: string; voterName: string }) => boolean;
  castVote: (survId: string, optionId: string) => void;
  createSurv: (input: {
    question: string;
    category: Category;
    options: SurvOption[];
    audience: Audience;
    durationMs: number;
  }) => Surv;
  actOn: (survId: string, optionId: string) => void;
  grade: (survId: string, outcome: Outcome) => void;
  addComment: (survId: string, text: string) => void;
  extendSurv: (survId: string, extraMs: number) => void;
  sweepExpired: () => void;
  createNest: (name: string, emoji: string, memberIds: string[]) => void;
  addToNest: (nestId: string, userId: string, tier?: ClosenessTier) => void;
  cycleTier: (nestId: string, userId: string) => void;
  toggleConnector: (connector: User['connectors'][number]) => void;
  resetDemo: () => void;
}

const Ctx = createContext<SurvStore | null>(null);

const TIER_CYCLE: Record<ClosenessTier, ClosenessTier> = {
  inner: 'regular',
  regular: 'outer',
  outer: 'inner',
};

/** Stable guest id from a display name, so repeat interactions accrue SAGE. */
const guestId = (name: string) => `u_g_${name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;

function makeGuest(name: string): User {
  return {
    id: guestId(name),
    handle: name.toLowerCase().replace(/\s+/g, ''),
    name,
    avatar: '🐣',
    bio: 'Joined via a shared SURV',
    clout: 35,
    categorySage: {},
    pairTrust: {},
    connectors: [],
  };
}

/** Flip any live SURV whose countdown has ended into the deciding state. */
function sweep(survs: Surv[], now = Date.now()): Surv[] {
  let changed = false;
  const next = survs.map((s) => {
    if (s.status === 'live' && s.expiresAt <= now) {
      changed = true;
      return { ...s, status: 'deciding' as const };
    }
    return s;
  });
  return changed ? next : survs;
}

export function SurvProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>(seedUsers);
  const [nests, setNests] = useState<Nest[]>(seedNests);
  const [survs, setSurvs] = useState<Surv[]>(() => sweep(seedSurvs()));
  const [calendarEvents, setCalendarEvents] = useState<CalEvent[]>([]);
  const [geo, setGeo] = useState<GeoState | null>(null);
  const [nearbyPlaces, setNearbyPlaces] = useState<Partial<Record<Category, NearbyPlace[]>>>({});
  const [hydrated, setHydrated] = useState(false);
  const skipNextSave = useRef(false);

  // Hydrate once from disk; seeds remain the first-run experience.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const saved = JSON.parse(raw) as PersistedState;
          if (saved.users?.length && saved.survs && saved.nests?.length) {
            skipNextSave.current = true;
            // Migration: newly-seeded discoverable people join existing saves.
            const known = new Set(saved.users.map((u) => u.id));
            const missing = seedUsers().filter((u) => !known.has(u.id));
            setUsers(missing.length > 0 ? [...saved.users, ...missing] : saved.users);
            setNests(saved.nests);
            setSurvs(sweep(saved.survs));
            setCalendarEvents(saved.calendarEvents ?? []);
            setGeo(saved.geo ?? null);
            setNearbyPlaces(saved.nearbyPlaces ?? {});
          }
        }
      } catch {
        // Corrupt state — fall through to seeds; next save overwrites it.
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  // Persist on every state change after hydration.
  useEffect(() => {
    if (!hydrated) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const state: PersistedState = { users, nests, survs, calendarEvents, geo, nearbyPlaces };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [users, nests, survs, calendarEvents, geo, nearbyPlaces, hydrated]);

  const store = useMemo<SurvStore>(() => {
    const userById = (id: string) => users.find((u) => u.id === id);
    const me = userById(ME)!;

    return {
      me,
      users,
      nests,
      survs,
      calendarEvents,
      geo,
      nearbyPlaces,
      hydrated,
      userById,

      requestLocation: async () => {
        const pos = await getCurrentPosition();
        if (!pos) return false;
        setGeo({ ...pos, city: null, updatedAt: Date.now() });
        // Enrich in the background: city name + real places per category.
        // Overpass rate-limits parallel queries, so fetch sequentially.
        reverseCity(pos)
          .then((city) => setGeo((g) => (g ? { ...g, city } : g)))
          .catch(() => {});
        (async () => {
          for (const category of GEO_CATEGORIES) {
            try {
              const places = await fetchNearbyPlaces(pos, category);
              if (places.length > 0) {
                setNearbyPlaces((prev) => ({ ...prev, [category]: places }));
              }
            } catch {
              // skip category on failure; next location request retries
            }
            await new Promise((r) => setTimeout(r, 700));
          }
        })();
        return true;
      },

      importCalendar: (icsText) => {
        const parsed = parseIcs(icsText);
        if (parsed.length === 0) return 0;
        setCalendarEvents((prev) => {
          const known = new Set(prev.map((e) => e.id));
          return [...prev, ...parsed.filter((e) => !known.has(e.id))].sort(
            (a, b) => a.start - b.start,
          );
        });
        return parsed.length;
      },

      setMyName: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        setUsers((prev) =>
          prev.map((u) => (u.id === ME ? { ...u, name: trimmed } : u)),
        );
      },

      importSurv: ({ surv, askerName }) => {
        if (survs.some((s) => s.id === surv.id)) {
          return survs.find((s) => s.id === surv.id) ?? null;
        }
        // The sender's askerId means "them", not us — remap to a guest identity.
        const asker = users.find((u) => u.name === askerName) ?? makeGuest(askerName);
        if (!users.some((u) => u.id === asker.id)) {
          setUsers((prev) => [...prev, asker]);
        }
        const imported: Surv = {
          ...surv,
          askerId: asker.id,
          votes: [],
          comments: [],
          status: surv.expiresAt > Date.now() ? 'live' : 'deciding',
        };
        setSurvs((prev) => [imported, ...prev]);
        return imported;
      },

      importVote: ({ survId, optionId, voterName }) => {
        const surv = survs.find((s) => s.id === survId);
        if (!surv || !surv.options.some((o) => o.id === optionId)) return false;
        const voter = users.find((u) => u.name === voterName) ?? makeGuest(voterName);
        if (surv.votes.some((v) => v.userId === voter.id)) return false;
        if (!users.some((u) => u.id === voter.id)) {
          setUsers((prev) => [...prev, voter]);
        }
        const asker = userById(surv.askerId) ?? me;
        const weight = voterWeight(voter, asker, surv.category, nests);
        setSurvs((prev) =>
          prev.map((s) =>
            s.id === survId
              ? { ...s, votes: [...s.votes, { userId: voter.id, optionId, weight, votedAt: Date.now() }] }
              : s,
          ),
        );
        return true;
      },

      castVote: (survId, optionId) => {
        setSurvs((prev) =>
          prev.map((s) => {
            if (s.id !== survId || s.votes.some((v) => v.userId === ME)) return s;
            const asker = userById(s.askerId);
            if (!asker) return s;
            const weight = voterWeight(me, asker, s.category, nests);
            return {
              ...s,
              votes: [...s.votes, { userId: ME, optionId, weight, votedAt: Date.now() }],
            };
          }),
        );
      },

      createSurv: ({ question, category, options, audience, durationMs }) => {
        const now = Date.now();
        const surv: Surv = {
          id: `s_${now}`,
          askerId: ME,
          question,
          category,
          options,
          audience,
          createdAt: now,
          expiresAt: now + durationMs,
          status: 'live',
          votes: [],
          comments: [],
        };
        setSurvs((prev) => [surv, ...prev]);
        return surv;
      },

      actOn: (survId, optionId) => {
        setSurvs((prev) =>
          prev.map((s) =>
            s.id === survId ? { ...s, status: 'acted', actedOptionId: optionId } : s,
          ),
        );
      },

      grade: (survId, outcome) => {
        const surv = survs.find((s) => s.id === survId);
        if (!surv || surv.status !== 'acted') return;
        // Deep-copy users so applyOutcome's mutations become a clean state update.
        const copies = new Map(
          users.map((u) => [
            u.id,
            { ...u, categorySage: { ...u.categorySage }, pairTrust: { ...u.pairTrust } },
          ]),
        );
        applyOutcome({ ...surv }, outcome, copies);
        setUsers([...copies.values()]);
        setSurvs((prev) =>
          prev.map((s) => (s.id === survId ? { ...s, status: 'graded', outcome } : s)),
        );
      },

      addComment: (survId, text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        setSurvs((prev) =>
          prev.map((s) =>
            s.id === survId
              ? {
                  ...s,
                  comments: [
                    ...(s.comments ?? []),
                    { id: `c_${Date.now()}`, userId: ME, text: trimmed, at: Date.now() },
                  ],
                }
              : s,
          ),
        );
      },

      extendSurv: (survId, extraMs) => {
        setSurvs((prev) =>
          prev.map((s) =>
            s.id === survId && s.askerId === ME && s.status === 'live'
              ? { ...s, expiresAt: s.expiresAt + extraMs }
              : s,
          ),
        );
      },

      sweepExpired: () => setSurvs((prev) => sweep(prev)),

      addToNest: (nestId, userId, tier = 'outer') => {
        setNests((prev) =>
          prev.map((n) => {
            if (n.id !== nestId || n.members.some((m) => m.userId === userId)) return n;
            return { ...n, members: [...n.members, { userId, tier }] };
          }),
        );
      },

      createNest: (name, emoji, memberIds) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const nest: Nest = {
          id: `n_${Date.now()}`,
          name: trimmed,
          emoji,
          ownerId: ME,
          members: [
            { userId: ME, tier: 'inner' },
            ...memberIds.filter((id) => id !== ME).map((userId) => ({
              userId,
              tier: 'regular' as ClosenessTier,
            })),
          ],
        };
        setNests((prev) => [...prev, nest]);
      },

      cycleTier: (nestId, userId) => {
        setNests((prev) =>
          prev.map((n) => {
            if (n.id !== nestId || n.ownerId !== ME || userId === ME) return n;
            return {
              ...n,
              members: n.members.map((m) =>
                m.userId === userId ? { ...m, tier: TIER_CYCLE[m.tier] } : m,
              ),
            };
          }),
        );
      },

      toggleConnector: (connector) => {
        setUsers((prev) =>
          prev.map((u) =>
            u.id === ME
              ? {
                  ...u,
                  connectors: u.connectors.includes(connector)
                    ? u.connectors.filter((c) => c !== connector)
                    : [...u.connectors, connector],
                }
              : u,
          ),
        );
      },

      resetDemo: () => {
        AsyncStorage.removeItem(STORAGE_KEY).catch(() => {});
        setUsers(seedUsers());
        setNests(seedNests());
        setSurvs(sweep(seedSurvs()));
        setCalendarEvents([]);
        setGeo(null);
        setNearbyPlaces({});
      },
    };
  }, [users, nests, survs, calendarEvents, geo, nearbyPlaces, hydrated]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useSurv(): SurvStore {
  const store = useContext(Ctx);
  if (!store) throw new Error('useSurv must be used inside SurvProvider');
  return store;
}
