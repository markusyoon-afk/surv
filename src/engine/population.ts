// The AI avatar population: 1,000 deterministic personas (scale POPULATION_SIZE
// to 10,000 once interaction quality is proven) with real profiles, category
// affinities, and growing SAGE. Generated lazily from a seed — zero storage
// cost until an avatar actually interacts, at which point it materializes
// into app state and learns through the same SAGE engine as everyone else.
// Star personas are FICTIONAL and clearly AI-labeled — no real-person clones.

import type { Category, SurvOption, User } from './types';
import { CATEGORIES } from './types';

export const POPULATION_SIZE = 100_000;

/** Day counter so every avatar's SAGE visibly grows over time — always building. */
const dayIndex = () => Math.floor(Date.now() / 86_400_000);

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ['Ava','Liam','Noah','Emma','Mia','Ethan','Sofia','Lucas','Amara','Kai','Zoe','Leo','Nina','Omar','Priya','Hana','Diego','Yuki','Tara','Jonas','Ivy','Marco','Lena','Ravi','Selin','Tomas','Aisha','Felix','Nora','Dante','Maya','Owen','Cleo','Hugo','Iris','Jae','Kira','Luca','Mei','Nico','Opal','Pablo','Quinn','Rosa','Sam','Tess','Umar','Vera','Wren','Ximena','Yara','Zane','Bodhi','Cora','Dax','Elif','Finn','Gia','Hank','Ines'];
const LAST = ['Kim','Lee','Chen','Patel','Garcia','Nguyen','Silva','Okafor','Haddad','Novak','Sato','Weber','Rossi','Kaur','Ali','Park','Cruz','Diaz','Wong','Ivanov','Costa','Moreau','Schmidt','Berg','Tanaka','Osei','Reyes','Yamada','Khan','Lopez','Meyer','Santos','Ferrari','Nakamura','Aydin','Johansson','Dubois','Fischer','Ramos','Kowalski','Andersen','Bello','Castillo','Duarte','Eriksen','Fontaine','Gupta','Hassan','Ito','Jansen','Keita','Lam','Mbeki','Nilsen','Ortiz','Petrov','Quispe','Rahman','Suzuki','Toure'];
const AVATARS = ['🦊','🐼','🐨','🦁','🐯','🦄','🐸','🐙','🦋','🐢','🦜','🐬','🦉','🐺','🦅','🐝','🦩','🦔','🐿️','🦢'];
const BIO_TEMPLATES = [
  'Decisive by nature. Ask me about {cat}.',
  '{cat} is my lane — I vote with reasons.',
  'Here to help you choose well. Strong on {cat}.',
  'Good calls only. {cat} first.',
  'Weighing options since forever. {cat} sage in training.',
];

/** Fictional star personas — the arena's headliners. */
export const STAR_AVATARS: User[] = [
  { id: 'ai_star_tayla', handle: 'taylaswiftwind', name: 'Tayla Swiftwind ✨', avatar: '🎤', bio: 'AI pop icon. Two hundred million followers worth of taste.', clout: 92, categorySage: { Entertainment: 95, Style: 88, Relationships: 80 }, pairTrust: {}, connectors: [], isAI: true },
  { id: 'ai_star_aurelio', handle: 'chefaurelio', name: 'Chef Aurelio 🔥', avatar: '👨‍🍳', bio: 'AI celebrity chef. Michelin instincts, street-food heart.', clout: 90, categorySage: { Food: 96, Travel: 74 }, pairTrust: {}, connectors: [], isAI: true },
  { id: 'ai_star_sky', handle: 'skyjordan', name: 'Sky Jordan 🏀', avatar: '🏆', bio: 'AI hoops legend. Built different, decides faster.', clout: 89, categorySage: { Sports: 95, Living: 70 }, pairTrust: {}, connectors: [], isAI: true },
  { id: 'ai_star_nova', handle: 'novamarsden', name: 'Nova Marsden 🚀', avatar: '🤖', bio: 'AI founder. Ships a hundred decisions a day.', clout: 88, categorySage: { Tech: 94, Work: 90 }, pairTrust: {}, connectors: [], isAI: true },
];

export function makeAvatar(i: number): User {
  const rand = mulberry32(90210 + i * 7);
  const name = `${FIRST[Math.floor(rand() * FIRST.length)]} ${LAST[Math.floor(rand() * LAST.length)]}`;
  const primary = CATEGORIES[Math.floor(rand() * CATEGORIES.length)];
  let secondary = CATEGORIES[Math.floor(rand() * CATEGORIES.length)];
  if (secondary === primary) secondary = CATEGORIES[(CATEGORIES.indexOf(primary) + 3) % CATEGORIES.length];
  // Base expertise plus a slow daily climb — the population never stops learning.
  const growth = Math.min(12, ((dayIndex() + i) % 13));
  const categorySage: Partial<Record<Category, number>> = {
    [primary]: Math.min(97, Math.round(40 + rand() * 45 + growth)),
    [secondary]: Math.min(90, Math.round(32 + rand() * 30 + growth / 2)),
  };
  return {
    id: `ai_${i}`,
    handle: name.toLowerCase().replace(/[^a-z]/g, '') + i,
    name,
    avatar: AVATARS[Math.floor(rand() * AVATARS.length)],
    bio: BIO_TEMPLATES[Math.floor(rand() * BIO_TEMPLATES.length)].replace('{cat}', primary),
    clout: Math.round(30 + rand() * 45),
    categorySage,
    pairTrust: {},
    connectors: [],
    isAI: true,
  };
}

// The population is VIRTUAL: 100,000 avatars exist as deterministic seeds and
// only materialize when touched. A small cache keeps hot avatars cheap.
const avatarCache = new Map<number, User>();

export function avatarAt(i: number): User {
  const idx = ((i % POPULATION_SIZE) + POPULATION_SIZE) % POPULATION_SIZE;
  let avatar = avatarCache.get(idx);
  if (!avatar) {
    if (avatarCache.size > 4000) avatarCache.clear();
    avatar = makeAvatar(idx);
    avatarCache.set(idx, avatar);
  }
  return avatar;
}

/** A materialized sample (stars first) — for leaderboards and browsing. */
export function getPopulation(sample = 200): User[] {
  return [...STAR_AVATARS, ...Array.from({ length: Math.min(sample, POPULATION_SIZE) }, (_, i) => avatarAt(i))];
}

/** Best advisor for a category from a deterministic sample of the 100k. */
export function pickAdvisor(category: Category, excludeIds: Set<string>, seed: number): User {
  const rand = mulberry32(seed);
  let best: User | null = null;
  let fallback: User | null = null;
  for (let n = 0; n < 48; n++) {
    const candidate = avatarAt(Math.floor(rand() * POPULATION_SIZE));
    if (excludeIds.has(candidate.id)) continue;
    if (!fallback) fallback = candidate;
    const sage = candidate.categorySage[category] ?? 0;
    if (sage >= 55 && (!best || sage > (best.categorySage[category] ?? 0))) best = candidate;
  }
  return best ?? fallback ?? avatarAt(Math.floor(rand() * POPULATION_SIZE));
}

/**
 * Well-informed option choice: rated/nearby facts first, then category fit,
 * never random when evidence exists.
 */
export function adviseOption(advisor: User, options: SurvOption[], seed: number): SurvOption {
  const rated = options
    .filter((o) => o.why && /★/.test(o.why))
    .sort((a, b) => (parseFloat(b.why!.match(/([\d.]+)★/)?.[1] ?? '0')) - (parseFloat(a.why!.match(/([\d.]+)★/)?.[1] ?? '0')));
  if (rated.length > 0) return rated[0];
  const located = options.find((o) => o.source === 'places' || o.source === 'nest');
  if (located) return located;
  const rand = mulberry32(seed);
  return options[Math.floor(rand() * options.length)];
}

const RATIONALES = [
  '{opt} is the smart call — {fact}. I’ve steered a lot of {cat} decisions this way.',
  'Take {opt}: {fact}. That’s the kind of signal I trust in {cat}.',
  'Easy one — {opt}. {fact}, and my {cat} track record says go.',
  '{opt}, no hesitation. {fact}. Good luck — report back with the verdict!',
];

export function advisorRationale(
  advisor: User,
  category: Category,
  option: SurvOption,
  seed: number,
): string {
  const rand = mulberry32(seed);
  const template = RATIONALES[Math.floor(rand() * RATIONALES.length)];
  const fact = option.why
    ? option.why.split('·')[0].trim()
    : `it’s the most actionable option on the table`;
  return template
    .replace(/\{opt\}/g, option.label)
    .replace('{fact}', fact)
    .replace(/\{cat\}/g, category);
}
