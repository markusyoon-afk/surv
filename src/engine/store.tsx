// On-device app store (React context) with AsyncStorage persistence. The engine
// stays pure; this file owns state transitions so a future backend can replace it
// behind the same interface.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { fetchNearbyPlaces, GEO_CATEGORIES, getCurrentPosition, reverseCity, type NearbyPlace } from '../lib/geo';
import { publishLive, subscribeLive } from '../lib/live';
import { arenaResult } from './arena';
import { adviseOption, advisorRationale, pickAdvisor } from './population';
import { applyArenaResult, applyOutcome, voterWeight } from './sage';
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
  arenaVotes?: Record<string, string>;
  arenaProcessed?: string[];
  healthConnected?: boolean;
}

interface SurvStore {
  me: User;
  users: User[];
  nests: Nest[];
  survs: Surv[];
  calendarEvents: CalEvent[];
  geo: GeoState | null;
  nearbyPlaces: Partial<Record<Category, NearbyPlace[]>>;
  /** My votes in the public arena, survId → optionId. */
  arenaVotes: Record<string, string>;
  healthConnected: boolean;
  setHealthConnected: (on: boolean) => void;
  voteArena: (survId: string, optionId: string) => void;
  /**
   * Heartbeat work: settle ended arena SURVs I voted on (self-training) and
   * let AI advisors engage my live SURVs. Returns news lines for notices.
   */
  liveTick: () => string[];
  hydrated: boolean;
  userById: (id: string) => User | undefined;
  /** GPS → city + real nearby places per category; suggestions become geolocated. */
  requestLocation: () => Promise<boolean>;
  /** Paste .ics text (Google Calendar / iCal export) → events feed the drafts engine. */
  importCalendar: (icsText: string) => number;
  setMyName: (name: string) => void;
  /** An invited/inviting human enters your world as a known face. */
  addAcquaintance: (name: string) => void;
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
  const [arenaVotes, setArenaVotes] = useState<Record<string, string>>({});
  const [arenaProcessed, setArenaProcessed] = useState<string[]>([]);
  const [healthConnected, setHealthConnectedState] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const skipNextSave = useRef(false);

  // Latest state for timer callbacks (advisor bursts outlive their render).
  const stateRef = useRef({ users, nests, survs });
  stateRef.current = { users, nests, survs };

  /** One AI advisor engages a SURV: informed vote, often with a reasoned comment. */
  const engageAdvisor = useCallback((survId: string): string | null => {
    const { users: u, nests: n, survs: s } = stateRef.current;
    const surv = s.find((x) => x.id === survId);
    const meUser = u.find((x) => x.id === ME);
    if (!surv || !meUser || surv.status !== 'live' || surv.expiresAt <= Date.now()) return null;
    const excludeIds = new Set(surv.votes.map((v) => v.userId));
    const advisor = pickAdvisor(
      surv.category,
      excludeIds,
      Date.now() + surv.id.length * 131 + surv.votes.length * 17,
    );
    if (excludeIds.has(advisor.id)) return null;
    const option = adviseOption(advisor, surv.options, Date.now() + surv.votes.length);
    const weight = voterWeight(advisor, meUser, surv.category, n);
    const withComment = Math.random() < 0.45;
    const rationale = advisorRationale(advisor, surv.category, option, Date.now() + 1);
    const now = Date.now();
    setUsers((prev) => (prev.some((x) => x.id === advisor.id) ? prev : [...prev, advisor]));
    setSurvs((prev) =>
      prev.map((x) => {
        if (x.id !== survId || x.votes.some((v) => v.userId === advisor.id)) return x;
        return {
          ...x,
          votes: [...x.votes, { userId: advisor.id, optionId: option.id, weight, votedAt: now }],
          comments: withComment
            ? [...(x.comments ?? []), { id: `c_ai_${now}_${advisor.id}`, userId: advisor.id, text: rationale, at: now }]
            : x.comments,
        };
      }),
    );
    return advisor.name;
  }, []);

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
            // Migration: the SATT Crew demo nest was retired.
            setNests(saved.nests.filter((n) => n.id !== 'n_satt'));
            setSurvs(sweep(saved.survs));
            setCalendarEvents(saved.calendarEvents ?? []);
            setGeo(saved.geo ?? null);
            setNearbyPlaces(saved.nearbyPlaces ?? {});
            setArenaVotes(saved.arenaVotes ?? {});
            setArenaProcessed(saved.arenaProcessed ?? []);
            setHealthConnectedState(saved.healthConnected ?? false);
          }
        }
      } catch {
        // Corrupt state — fall through to seeds; next save overwrites it.
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  // Live layer: comments from other tabs/devices land in real time.
  useEffect(() => {
    return subscribeLive((msg) => {
      if (msg.type !== 'comment') return;
      setUsers((prevUsers) => {
        // Remote author: an existing user when the name matches, else a guest.
        const author =
          prevUsers.find((u) => u.name === msg.authorName) ?? makeGuest(msg.authorName || 'Guest');
        setSurvs((prev) =>
          prev.map((s) => {
            if (s.id !== msg.survId) return s;
            if ((s.comments ?? []).some((c) => c.id === msg.comment.id)) return s;
            return { ...s, comments: [...(s.comments ?? []), { ...msg.comment, userId: author.id }] };
          }),
        );
        return prevUsers.some((u) => u.id === author.id) ? prevUsers : [...prevUsers, author];
      });
    });
  }, []);

  // Persist on every state change after hydration.
  useEffect(() => {
    if (!hydrated) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const state: PersistedState = {
      users,
      nests,
      survs,
      calendarEvents,
      geo,
      nearbyPlaces,
      arenaVotes,
      arenaProcessed,
      healthConnected,
    };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [users, nests, survs, calendarEvents, geo, nearbyPlaces, arenaVotes, arenaProcessed, healthConnected, hydrated]);

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

      arenaVotes,
      healthConnected,
      setHealthConnected: (on) => setHealthConnectedState(on),

      voteArena: (survId, optionId) => {
        setArenaVotes((prev) => (prev[survId] ? prev : { ...prev, [survId]: optionId }));
      },

      liveTick: () => {
        const news: string[] = [];
        const now = Date.now();

        // 1. Settle ended arena SURVs I helped decide — self-training.
        const pending = Object.entries(arenaVotes).filter(([id]) => !arenaProcessed.includes(id));
        const settled: string[] = [];
        for (const [survId, optionId] of pending) {
          const result = arenaResult(survId, now);
          if (!result) continue;
          settled.push(survId);
          const actedOption = result.options[result.actedIndex];
          const aligned = actedOption?.id === optionId;
          setUsers((prev) =>
            prev.map((u) => {
              if (u.id !== ME) return u;
              const copy = { ...u, categorySage: { ...u.categorySage } };
              const { sageDelta } = applyArenaResult(copy, result.category, aligned, result.outcome);
              if (aligned && result.outcome === 'good') {
                news.push(
                  `Your call on “${result.question}” was a good one — +${Math.abs(Math.round(sageDelta * 10) / 10)} ${result.category} SAGE 🦉`,
                );
              } else if (!aligned && result.outcome === 'bad') {
                news.push(`You warned against “${result.question}” — right call. SAGE up.`);
              }
              return copy;
            }),
          );
        }
        if (settled.length > 0) setArenaProcessed((prev) => [...prev, ...settled]);

        // 2. AI advisors engage my live SURVs. The Forest floods (up to ~40
        //    voices, several per beat); Nest SURVs get a gentle trickle.
        const mine = survs.filter(
          (s) => s.askerId === ME && s.status === 'live' && s.expiresAt > now,
        );
        for (const surv of mine) {
          const isForest = surv.audience.kind === 'public';
          const cap = isForest ? 40 : 5;
          if (surv.votes.length >= cap) continue;
          const rounds = isForest ? 1 + Math.floor(Math.random() * 3) : Math.random() < 0.5 ? 1 : 0;
          for (let k = 0; k < rounds; k++) {
            const name = engageAdvisor(surv.id);
            if (name && k === 0) {
              news.push(`${name} voted on “${surv.question.slice(0, 40)}…” with a reason 🤖`);
            }
          }
        }

        return news;
      },

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

      addAcquaintance: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        setUsers((prev) =>
          prev.some((u) => u.name === trimmed) ? prev : [...prev, makeGuest(trimmed)],
        );
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
        // The Forest answers immediately: a staggered burst of advisor votes
        // lands in the first seconds, then the heartbeat keeps them coming.
        if (audience.kind === 'public') {
          for (const delay of [1200, 3000, 5500, 8500, 12_000, 16_500, 22_000, 28_000]) {
            setTimeout(() => engageAdvisor(surv.id), delay);
          }
        }
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
          prev.map((s) =>
            s.id === survId ? { ...s, status: 'graded', outcome, gradedAt: Date.now() } : s,
          ),
        );
      },

      addComment: (survId, text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const comment = { id: `c_${Date.now()}_${Math.floor(Math.random() * 1e4)}`, userId: ME, text: trimmed, at: Date.now() };
        setSurvs((prev) =>
          prev.map((s) =>
            s.id === survId ? { ...s, comments: [...(s.comments ?? []), comment] } : s,
          ),
        );
        publishLive({ type: 'comment', survId, comment, authorName: me.name });
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
        setArenaVotes({});
        setArenaProcessed([]);
        setHealthConnectedState(false);
      },
    };
  }, [users, nests, survs, calendarEvents, geo, nearbyPlaces, arenaVotes, arenaProcessed, healthConnected, hydrated]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useSurv(): SurvStore {
  const store = useContext(Ctx);
  if (!store) throw new Error('useSurv must be used inside SurvProvider');
  return store;
}
