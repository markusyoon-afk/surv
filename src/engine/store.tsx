// On-device app store (React context). The engine stays pure; this file owns state
// transitions so a future backend can replace it behind the same interface.

import React, { createContext, useContext, useMemo, useState } from 'react';
import { applyOutcome, voterWeight } from './sage';
import { ME, seedNests, seedSurvs, seedUsers } from './seed';
import type { Audience, Category, Nest, Outcome, Surv, SurvOption, User } from './types';

interface SurvStore {
  me: User;
  users: User[];
  nests: Nest[];
  survs: Surv[];
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
  toggleConnector: (connector: User['connectors'][number]) => void;
}

const Ctx = createContext<SurvStore | null>(null);

export function SurvProvider({ children }: { children: React.ReactNode }) {
  const [users, setUsers] = useState<User[]>(seedUsers);
  const [nests] = useState<Nest[]>(seedNests);
  const [survs, setSurvs] = useState<Surv[]>(() => seedSurvs());

  const store = useMemo<SurvStore>(() => {
    const userById = (id: string) => users.find((u) => u.id === id);
    const me = userById(ME)!;

    return {
      me,
      users,
      nests,
      survs,
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
    };
  }, [users, nests, survs]);

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useSurv(): SurvStore {
  const store = useContext(Ctx);
  if (!store) throw new Error('useSurv must be used inside SurvProvider');
  return store;
}
