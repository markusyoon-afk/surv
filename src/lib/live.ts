// The live layer: realtime comment sync and typing presence. v1 transport is
// BroadcastChannel (genuinely live across tabs/windows of the same browser);
// the Supabase realtime channel drops in behind this exact interface for
// cross-phone multiplayer.

import { Platform } from 'react-native';
import type { SurvComment } from '../engine/types';

export type LiveMessage =
  | { type: 'comment'; survId: string; comment: SurvComment; authorName: string }
  | { type: 'typing'; survId: string; name: string };

type Handler = (msg: LiveMessage) => void;

const handlers = new Set<Handler>();
let channel: BroadcastChannel | null = null;
let ready = false;

function ensure(): void {
  if (ready) return;
  ready = true;
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !('BroadcastChannel' in window)) {
    return;
  }
  channel = new BroadcastChannel('surv-live');
  channel.onmessage = (e: MessageEvent<LiveMessage>) => {
    for (const h of handlers) h(e.data);
  };
}

export function publishLive(msg: LiveMessage): void {
  ensure();
  try {
    channel?.postMessage(msg);
  } catch {
    // transport unavailable — single-device mode
  }
}

export function subscribeLive(handler: Handler): () => void {
  ensure();
  handlers.add(handler);
  return () => handlers.delete(handler);
}

/** "2h ago" style timestamps for the Round Table. */
export function timeAgo(at: number, now = Date.now()): string {
  const mins = Math.max(0, Math.floor((now - at) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
