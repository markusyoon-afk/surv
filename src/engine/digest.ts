// The Nest activity digest: what happened in your sphere and what needs you,
// distilled to a few lines on the home feed. Pure function — testable.

import type { Nest, Surv, User } from './types';

export interface DigestItem {
  /** Ionicons name */
  icon: string;
  text: string;
  /** Where tapping should take the user. */
  target: 'profile' | 'feed';
}

const DAY = 86_400_000;
const WEEK = 7 * DAY;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export function buildDigest(
  me: User,
  users: User[],
  nests: Nest[],
  survs: Surv[],
  now = Date.now(),
): DigestItem[] {
  const items: DigestItem[] = [];
  const myNestIds = new Set(
    nests
      .filter((n) => n.ownerId === me.id || n.members.some((m) => m.userId === me.id))
      .map((n) => n.id),
  );

  // 1. Decisions waiting on you (act or grade).
  const due = survs.filter(
    (s) => s.askerId === me.id && (s.status === 'deciding' || s.status === 'acted'),
  ).length;
  if (due > 0) {
    items.push({
      icon: 'alert-circle',
      text: `${plural(due, 'decision')} waiting on you — act on it, then swipe the verdict`,
      target: 'profile',
    });
  }

  // 2. Fresh votes on your SURVs in the last 24h.
  const recentVotes = survs
    .filter((s) => s.askerId === me.id)
    .flatMap((s) => s.votes.filter((v) => v.userId !== me.id && now - v.votedAt < DAY));
  if (recentVotes.length > 0) {
    const names = [
      ...new Set(
        recentVotes
          .map((v) => users.find((u) => u.id === v.userId)?.name.split(' ')[0])
          .filter(Boolean) as string[],
      ),
    ];
    const who =
      names.length <= 2 ? names.join(' and ') : `${names.slice(0, 2).join(', ')} +${names.length - 2} more`;
    items.push({
      icon: 'trending-up',
      text: `${plural(recentVotes.length, 'new vote')} on your SURVs — ${who} weighed in`,
      target: 'feed',
    });
  }

  // 3. Verdicts you closed this week.
  const graded = survs.filter(
    (s) => s.askerId === me.id && s.status === 'graded' && (s.gradedAt ?? 0) > now - WEEK,
  );
  if (graded.length > 0) {
    const good = graded.filter((s) => s.outcome === 'good').length;
    items.push({
      icon: 'checkmark-done',
      text: `You closed ${plural(graded.length, 'decision')} this week — ${good} turned out to be good calls`,
      target: 'profile',
    });
  }

  // 4. New SURVs from your Nests today.
  const fresh = survs.filter(
    (s) =>
      s.askerId !== me.id &&
      now - s.createdAt < DAY &&
      (s.audience.kind === 'public' || s.audience.nestIds.some((id) => myNestIds.has(id))),
  );
  if (fresh.length > 0) {
    items.push({
      icon: 'sparkles',
      text: `${plural(fresh.length, 'new SURV')} from your circles today — your vote moves their call`,
      target: 'feed',
    });
  }

  // 5. Your current oracle: the strongest sage among your nestmates.
  let oracle: { name: string; category: string; sage: number } | null = null;
  for (const u of users) {
    if (u.id === me.id) continue;
    const inMyNests = nests.some(
      (n) => myNestIds.has(n.id) && (n.ownerId === u.id || n.members.some((m) => m.userId === u.id)),
    );
    if (!inMyNests) continue;
    for (const [category, sage] of Object.entries(u.categorySage) as Array<[string, number]>) {
      if (!oracle || sage > oracle.sage) oracle = { name: u.name.split(' ')[0], category, sage };
    }
  }
  if (oracle && oracle.sage >= 60) {
    items.push({
      icon: 'ribbon',
      text: `${oracle.name} is your top sage right now — ${oracle.category} ${Math.round(oracle.sage)}%`,
      target: 'feed',
    });
  }

  return items.slice(0, 4);
}
