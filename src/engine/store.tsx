// On-device app store (React context) with AsyncStorage persistence. The engine
// stays pure; this file owns state transitions so a future backend can replace it
// behind the same interface.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { applyOutcome, voterWeight } from './sage';
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

interface PersistedState {
  users: User[];
  nests: Nest[];
  survs: Surv[];
}

interface SurvStore {
  me: User;
  users: User[];
  nests: Nest[];
  survs: Surv[];
  hydrated: boolean;
  userById: (id: string) => User | undefined;
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
            setUsers(saved.users);
            setNests(saved.nests);
            setSurvs(sweep(saved.survs));
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
    const state: PersistedState = { users, nests, survs };
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [users, nests, survs, hydrated]);

  const store = useMemo<SurvStore>(() => {
    const userById = (id: string) => users.find((u) => u.id === id);
    const me = userById(ME)!;

    return {
      me,
      users,
      nests,
      survs,
      hydrated,
      userById,

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
      },
    };
  }, [users, nests, survs, hydrated]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useSurv(): SurvStore {
  const store = useContext(Ctx);
  if (!store) throw new Error('useSurv must be used inside SurvProvider');
  return store;
}
