// Cross-device sharing with zero backend: SURVs and vote-backs travel as links
// (iMessage/WhatsApp are the transport). A friend opens your link in the web app,
// the SURV imports onto their device; their vote travels back the same way and
// lands in your tally — feeding your SAGE algorithm.

import { Platform, Share } from 'react-native';
import type { Surv } from '../engine/types';

export interface SurvPacket {
  surv: Omit<Surv, 'votes' | 'comments'>;
  askerName: string;
}

export interface VotePacket {
  survId: string;
  optionId: string;
  voterName: string;
}

export type ShareHashPayload =
  | { kind: 'surv'; packet: SurvPacket }
  | { kind: 'vote'; packet: VotePacket }
  | { kind: 'invite'; inviterName: string };

/** The canonical public home of the app — used when sharing from native. */
export const LIVE_URL = 'https://markusyoon-afk.github.io/surv/';

const enc = (o: unknown) => encodeURIComponent(JSON.stringify(o));

function dec<T>(raw: string): T | null {
  try {
    return JSON.parse(decodeURIComponent(raw)) as T;
  } catch {
    return null;
  }
}

const onWeb = () => Platform.OS === 'web' && typeof window !== 'undefined';

/**
 * The base every shared link is built on. A recipient must always be able to
 * open it — so dev/preview origins (localhost etc.) fall back to the canonical
 * live URL, and native shares use it directly. A future custom domain works
 * automatically because the real hosted origin passes through.
 */
export function appBaseUrl(): string {
  if (!onWeb()) return LIVE_URL;
  const { hostname } = window.location;
  if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname.endsWith('.local')) {
    return LIVE_URL;
  }
  return window.location.origin + window.location.pathname;
}

export function survShareUrl(surv: Surv, askerName: string): string | null {
  const base = appBaseUrl();
  if (!base) return null;
  const { votes: _v, comments: _c, ...rest } = surv;
  const packet: SurvPacket = { surv: rest, askerName };
  return `${base}#s=${enc(packet)}`;
}

export function voteBackUrl(packet: VotePacket): string | null {
  const base = appBaseUrl();
  if (!base) return null;
  return `${base}#v=${enc(packet)}`;
}

/** Invite a real human: they open this, onboard, and you're in their circle. */
export function inviteUrl(myName: string): string {
  const base = appBaseUrl() ?? LIVE_URL;
  return `${base}#i=${encodeURIComponent(myName)}`;
}

export function parseShareHash(): ShareHashPayload | null {
  if (!onWeb()) return null;
  const hash = window.location.hash;
  if (hash.startsWith('#i=')) {
    const inviterName = decodeURIComponent(hash.slice(3)).trim();
    if (inviterName) return { kind: 'invite', inviterName };
  }
  if (hash.startsWith('#s=')) {
    const packet = dec<SurvPacket>(hash.slice(3));
    if (packet?.surv?.id && packet.surv.question) return { kind: 'surv', packet };
  }
  if (hash.startsWith('#v=')) {
    const packet = dec<VotePacket>(hash.slice(3));
    if (packet?.survId && packet.optionId && packet.voterName) return { kind: 'vote', packet };
  }
  return null;
}

export function clearShareHash(): void {
  if (!onWeb()) return;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

/** Share via the native sheet where available; clipboard fallback on desktop. */
export async function shareText(message: string): Promise<'shared' | 'copied' | 'failed'> {
  if (onWeb()) {
    const nav = window.navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
    if (nav.share) {
      try {
        await nav.share({ text: message });
        return 'shared';
      } catch (e) {
        // The sheet opened and the user closed it — that's not a failure.
        if ((e as Error)?.name === 'AbortError') return 'shared';
        // Real share failure → fall through to the clipboard.
      }
    }
    try {
      await window.navigator.clipboard.writeText(message);
      return 'copied';
    } catch {
      return 'failed';
    }
  }
  try {
    await Share.share({ message });
    return 'shared';
  } catch {
    return 'failed';
  }
}
