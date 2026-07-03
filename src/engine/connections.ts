// Connection discovery: people you likely know from your connected platforms
// (Facebook / Instagram / Discord / review networks) who aren't in your Nests
// yet. In v1 platform overlap is computed from each user's linked connectors;
// real friend-graph APIs slot in behind the same interface.

import type { ConnectorId, Nest, User } from './types';

export interface ConnectionSuggestion {
  user: User;
  sharedPlatforms: ConnectorId[];
  reason: string;
}

const PLATFORM_NAMES: Record<ConnectorId, string> = {
  facebook: 'Facebook',
  instagram: 'Instagram',
  discord: 'Discord',
  yelp: 'Yelp',
  google_reviews: 'Google Reviews',
};

/** People not in any of my Nests, ranked by platform overlap then Clout. */
export function suggestConnections(me: User, users: User[], nests: Nest[]): ConnectionSuggestion[] {
  const inMyNests = new Set<string>();
  for (const n of nests) {
    const mine = n.ownerId === me.id || n.members.some((m) => m.userId === me.id);
    if (!mine) continue;
    for (const m of n.members) inMyNests.add(m.userId);
    inMyNests.add(n.ownerId);
  }

  return users
    .filter((u) => u.id !== me.id && !inMyNests.has(u.id) && !u.id.startsWith('u_g_'))
    .map((user) => {
      const sharedPlatforms = user.connectors.filter((c) => me.connectors.includes(c));
      const reason =
        sharedPlatforms.length > 0
          ? `Also on ${sharedPlatforms.map((p) => PLATFORM_NAMES[p]).join(' · ')}`
          : 'On SURV';
      return { user, sharedPlatforms, reason };
    })
    .sort(
      (a, b) =>
        b.sharedPlatforms.length - a.sharedPlatforms.length || b.user.clout - a.user.clout,
    )
    .slice(0, 8);
}
