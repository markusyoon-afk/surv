// Seed data. The cast and several questions come straight from the 2011 alpha
// database (surv.sql) — the original SATT crew rides again.

import type { Nest, Surv, User } from './types';

const HOUR = 3600_000;
const DAY = 24 * HOUR;

export const ME = 'u_markus';

/**
 * The founder's earned standing: Masked Sage (75%+ band) with a veteran record —
 * deep evidence counts keep the adaptive gain stable. Also applied as a hydration
 * migration so existing saves level up.
 */
export const FOUNDER_PROFILE = {
  clout: 78,
  categorySage: {
    Work: 84,
    Tech: 79,
    Food: 76,
    Living: 74,
    Entertainment: 72,
    Relationships: 71,
    Shopping: 70,
    Travel: 68,
    Sports: 62,
    Style: 60,
  } as User['categorySage'],
  categoryN: {
    Work: 26,
    Tech: 21,
    Food: 18,
    Living: 14,
    Entertainment: 12,
    Relationships: 11,
    Shopping: 10,
    Travel: 9,
    Sports: 7,
    Style: 6,
  } as User['categoryN'],
};

/** Level an existing save's founder up to Masked Sage; never downgrades earned progress. */
export function levelUpFounder(u: User): User {
  if (u.id !== ME || u.clout >= 75) return u;
  const categorySage = { ...FOUNDER_PROFILE.categorySage };
  for (const [cat, val] of Object.entries(u.categorySage)) {
    const key = cat as keyof User['categorySage'];
    if (val !== undefined && (categorySage[key] ?? 0) < val) categorySage[key] = val;
  }
  const categoryN = { ...FOUNDER_PROFILE.categoryN };
  for (const [cat, val] of Object.entries(u.categoryN ?? {})) {
    const key = cat as keyof NonNullable<User['categoryN']>;
    if (val !== undefined && (categoryN[key] ?? 0) < val) categoryN[key] = val;
  }
  return { ...u, clout: Math.max(u.clout, FOUNDER_PROFILE.clout), categorySage, categoryN };
}

export function seedUsers(): User[] {
  return [
    {
      id: ME,
      handle: 'markus',
      name: 'Markus Yoon',
      avatar: '🦉',
      bio: 'Founder. Live it, SURV it!',
      clout: FOUNDER_PROFILE.clout,
      categorySage: { ...FOUNDER_PROFILE.categorySage },
      categoryN: { ...FOUNDER_PROFILE.categoryN },
      pairTrust: { u_mike: 0.7, u_insup: 0.62, u_joe: 0.66 },
      connectors: ['yelp', 'google_reviews', 'discord'],
    },
    {
      id: 'u_mike',
      handle: 'mike',
      name: 'Mike Lemke',
      avatar: '🧢',
      bio: 'Original SURV coder. philosophicalart.com',
      clout: 58,
      categorySage: { Tech: 72, Gaming: 60, Work: 48 } as User['categorySage'],
      pairTrust: {},
      connectors: ['discord'],
    },
    {
      id: 'u_insup',
      handle: 'ohjinguh77',
      name: 'InSup Oh',
      avatar: '🎸',
      bio: 'Pedalboard architect. How to best set this up… hmmm :-)',
      clout: 51,
      categorySage: { Entertainment: 64, Style: 45 },
      pairTrust: {},
      connectors: ['instagram', 'facebook'],
    },
    {
      id: 'u_joe',
      handle: 'josephsongyoon',
      name: 'Joseph Yoon',
      avatar: '🏀',
      bio: 'Hoops + grad school decisions.',
      clout: 47,
      categorySage: { Sports: 68, Education: 50 } as User['categorySage'],
      pairTrust: {},
      connectors: ['facebook'],
    },
    {
      id: 'u_linda',
      handle: 'lindachang718',
      name: 'Linda Chang',
      avatar: '🍜',
      bio: 'Knows every restaurant worth knowing.',
      clout: 63,
      categorySage: { Food: 81, Travel: 58 },
      pairTrust: {},
      connectors: ['yelp', 'instagram'],
    },
    {
      id: 'u_eric',
      handle: 'eric.seto',
      name: 'Eric Seto',
      avatar: '📈',
      bio: 'Careful with money, generous with opinions.',
      clout: 54,
      categorySage: { Shopping: 66, Living: 59, Work: 52 },
      pairTrust: {},
      connectors: ['google_reviews'],
    },
    {
      id: 'u_dan',
      handle: 'danko9',
      name: 'Dan Ko',
      avatar: '🎬',
      bio: 'Movie night commissioner.',
      clout: 44,
      categorySage: { Entertainment: 70 },
      pairTrust: {},
      connectors: ['discord', 'instagram'],
    },
    // Familiar faces from the 2012 feed — discoverable, not yet in any Nest.
    {
      id: 'u_thomas',
      handle: 'thomaskim',
      name: 'Thomas Kim',
      avatar: '🧑‍💻',
      bio: 'We have a fresh look! Building things for good.',
      clout: 46,
      categorySage: { Tech: 58, Work: 52 },
      pairTrust: {},
      connectors: ['facebook', 'instagram'],
    },
    {
      id: 'u_william',
      handle: 'williamko',
      name: 'William Ko',
      avatar: '😼',
      bio: 'Tells things like they are.',
      clout: 41,
      categorySage: { Living: 50 },
      pairTrust: {},
      connectors: ['facebook', 'discord'],
    },
    {
      id: 'u_changhee',
      handle: 'changheekim',
      name: 'Chang Hee Kim',
      avatar: '🏈',
      bio: 'Wilfork and the D-line dominate.',
      clout: 48,
      categorySage: { Sports: 62 },
      pairTrust: {},
      connectors: ['facebook', 'yelp'],
    },
  ];
}

export function seedNests(): Nest[] {
  return [
    {
      id: 'n_fam',
      name: 'Family',
      emoji: '🪺',
      ownerId: ME,
      members: [
        { userId: ME, tier: 'inner' },
        { userId: 'u_joe', tier: 'inner' },
        { userId: 'u_linda', tier: 'regular' },
      ],
    },
    {
      id: 'n_foodies',
      name: 'Foodies',
      emoji: '🍽️',
      ownerId: 'u_linda',
      members: [
        { userId: 'u_linda', tier: 'inner' },
        { userId: ME, tier: 'regular' },
        { userId: 'u_insup', tier: 'regular' },
      ],
    },
  ];
}

export function seedSurvs(now = Date.now()): Surv[] {
  return [
    {
      // surv #4 from the 2011 alpha DB — and the 72.2% Pasta result from the beta screenshot
      id: 's_lunch',
      askerId: 'u_eric',
      question: 'What should I bring to work for lunch?',
      category: 'Food',
      options: [
        { id: 'o_salami', label: 'Salami sandwich', source: 'user' },
        { id: 'o_soup', label: 'Soup', source: 'user' },
        { id: 'o_pasta', label: 'Pasta', source: 'user' },
      ],
      audience: { kind: 'nests', nestIds: ['n_fam'] },
      createdAt: now - 3 * HOUR,
      expiresAt: now + 21 * HOUR,
      status: 'live',
      votes: [
        { userId: 'u_linda', optionId: 'o_pasta', weight: 0.71, votedAt: now - 2 * HOUR },
        { userId: 'u_mike', optionId: 'o_pasta', weight: 0.52, votedAt: now - 1 * HOUR },
        { userId: 'u_insup', optionId: 'o_soup', weight: 0.47, votedAt: now - 1 * HOUR },
      ],
    },
    {
      // surv #114 from the alpha DB
      id: 's_grad',
      askerId: 'u_joe',
      question: 'Which grad school should I attend?',
      category: 'Work',
      options: [
        { id: 'o_nu', label: 'Northwestern', source: 'user' },
        { id: 'o_nyu', label: 'NYU', source: 'user' },
        { id: 'o_bu', label: 'BU', source: 'user' },
      ],
      audience: { kind: 'nests', nestIds: ['n_fam'] },
      createdAt: now - 20 * HOUR,
      expiresAt: now + 4 * HOUR,
      status: 'live',
      votes: [
        { userId: ME, optionId: 'o_nu', weight: 0.55, votedAt: now - 18 * HOUR },
        { userId: 'u_eric', optionId: 'o_nu', weight: 0.5, votedAt: now - 10 * HOUR },
        { userId: 'u_mike', optionId: 'o_nyu', weight: 0.49, votedAt: now - 6 * HOUR },
      ],
    },
    {
      // surv #69 from the alpha DB — the 53.7% "No" from the beta screenshot
      id: 's_streak',
      askerId: 'u_linda',
      question: 'I’ve always wanted a brightly colored streak in my hair. Should I do it?',
      category: 'Style',
      options: [
        { id: 'o_yes', label: 'Yes — do it', source: 'user' },
        { id: 'o_no', label: 'No', source: 'user' },
        { id: 'o_color', label: 'Depends on the color', source: 'user' },
      ],
      audience: { kind: 'public' },
      createdAt: now - 30 * HOUR,
      expiresAt: now + 18 * HOUR,
      status: 'live',
      votes: [
        { userId: 'u_insup', optionId: 'o_yes', weight: 0.5, votedAt: now - 20 * HOUR },
        { userId: 'u_dan', optionId: 'o_no', weight: 0.44, votedAt: now - 12 * HOUR },
        { userId: 'u_eric', optionId: 'o_no', weight: 0.46, votedAt: now - 8 * HOUR },
      ],
    },
    {
      // An expired SURV of mine, waiting for me to Act — demos the decision step
      id: 's_pedal',
      askerId: ME,
      question: 'Team dinner after we ship the beta — where do we go?',
      category: 'Food',
      options: [
        { id: 'o_thai', label: 'Ruby of Siam', source: 'yelp', why: '4.5★ on Yelp near you' },
        { id: 'o_greek', label: 'Dengeos', source: 'yelp', why: '4.2★ on Yelp near you' },
        { id: 'o_cook', label: 'Cookout at my place', source: 'user' },
      ],
      audience: { kind: 'nests', nestIds: ['n_foodies'] },
      createdAt: now - 2 * DAY,
      expiresAt: now - 1 * HOUR,
      status: 'deciding',
      votes: [
        { userId: 'u_linda', optionId: 'o_thai', weight: 0.73, votedAt: now - DAY },
        { userId: 'u_mike', optionId: 'o_cook', weight: 0.5, votedAt: now - DAY },
        { userId: 'u_insup', optionId: 'o_thai', weight: 0.51, votedAt: now - 30 * HOUR },
        { userId: 'u_dan', optionId: 'o_greek', weight: 0.45, votedAt: now - 26 * HOUR },
      ],
      comments: [
        {
          id: 'c_seed1',
          userId: 'u_linda',
          text: 'Ruby of Siam, trust me — get the crispy duck curry.',
          at: now - DAY,
        },
        {
          id: 'c_seed2',
          userId: 'u_mike',
          text: 'Cookout means I can finally show off the smoker. Just saying.',
          at: now - 22 * HOUR,
        },
      ],
    },
    {
      // An acted-on SURV awaiting my verdict — demos the swipe feedback step
      id: 's_bike',
      askerId: ME,
      question: 'Casual bike for the city — what kind do I get?',
      category: 'Shopping',
      options: [
        { id: 'o_mtn', label: 'Mountain bike', source: 'user' },
        { id: 'o_road', label: 'Road bike', source: 'user' },
        { id: 'o_hybrid', label: 'Hybrid', source: 'ai', why: 'Based on your past SURVs' },
      ],
      audience: { kind: 'nests', nestIds: ['n_fam'] },
      createdAt: now - 6 * DAY,
      expiresAt: now - 4 * DAY,
      status: 'acted',
      actedOptionId: 'o_hybrid',
      votes: [
        { userId: 'u_eric', optionId: 'o_hybrid', weight: 0.6, votedAt: now - 5 * DAY },
        { userId: 'u_mike', optionId: 'o_hybrid', weight: 0.5, votedAt: now - 5 * DAY },
        { userId: 'u_joe', optionId: 'o_road', weight: 0.48, votedAt: now - 5 * DAY },
      ],
    },
  ];
}
