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
  | { kind: 'vote'; packet: VotePacket };

const enc = (o: unknown) => encodeURIComponent(JSON.stringify(o));

function dec<T>(raw: string): T | null {
  try {
    return JSON.parse(decodeURIComponent(raw)) as T;
  } catch {
    return null;
  }
}

const onWeb = () => Platform.OS === 'web' && typeof window !== 'undefined';

/** The app's own URL when running on web (works for LAN, tunnel, or hosted). */
export function appBaseUrl(): string | null {
  if (!onWeb()) return null;
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

export function parseShareHash(): ShareHashPayload | null {
  if (!onWeb()) return null;
  const hash = window.location.hash;
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
  try {
    if (onWeb()) {
      const nav = window.navigator as Navigator & { share?: (d: { text: string }) => Promise<void> };
      if (nav.share) {
        await nav.share({ text: message });
        return 'shared';
      }
      await window.navigator.clipboard.writeText(message);
      return 'copied';
    }
    await Share.share({ message });
    return 'shared';
  } catch {
    return 'failed';
  }
}
