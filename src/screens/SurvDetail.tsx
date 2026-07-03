// SURV detail overlay: full results (weighted + raw), voter weights, countdown,
// and — for your own expired SURVs — the "Act on it" step.

import React, { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SageBar } from '../components/SurvCard';
import { displayWeight, formatRemaining, msRemaining, tally, winningOption } from '../engine/sage';
import { useSurv } from '../engine/store';
import type { Surv } from '../engine/types';
import { publishLive, subscribeLive, timeAgo } from '../lib/live';
import { shareText, survShareUrl, voteBackUrl } from '../lib/share';
import { colors, radius } from '../theme';

const HOUR = 3600_000;

export function SurvDetail({ surv, onClose }: { surv: Surv | null; onClose: () => void }) {
  const { me, userById, castVote, actOn, addComment, extendSurv } = useSurv();
  const [comment, setComment] = useState('');
  const [shareNote, setShareNote] = useState<string | null>(null);
  const [typingName, setTypingName] = useState<string | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSent = useRef(0);
  const survId = surv?.id;

  // Live presence: show who's writing in this Round Table right now.
  useEffect(() => {
    if (!survId) return;
    return subscribeLive((msg) => {
      if (msg.type !== 'typing' || msg.survId !== survId || msg.name === me.name) return;
      setTypingName(msg.name);
      if (typingTimer.current) clearTimeout(typingTimer.current);
      typingTimer.current = setTimeout(() => setTypingName(null), 3000);
    });
  }, [survId, me.name]);

  if (!surv) return null;

  const onCommentChange = (text: string) => {
    setComment(text);
    const now = Date.now();
    if (text.trim() && now - lastTypingSent.current > 1500) {
      lastTypingSent.current = now;
      publishLive({ type: 'typing', survId: surv.id, name: me.name });
    }
  };

  const doShare = async (message: string) => {
    const result = await shareText(message);
    setShareNote(
      result === 'copied' ? 'Link copied — paste it to your Nest' : result === 'failed' ? 'Could not open the share sheet' : null,
    );
  };

  const asker = userById(surv.askerId);
  const isMine = surv.askerId === me.id;
  const myVote = surv.votes.find((v) => v.userId === me.id);
  const live = surv.status === 'live' && msRemaining(surv) > 0;
  const needsDecision = isMine && !live && !surv.actedOptionId;
  const results = tally(surv);
  const winner = winningOption(surv);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }}>
            <View style={styles.headerRow}>
              <Text style={styles.avatar}>{asker?.avatar}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.asker}>{isMine ? 'Your SURV' : asker?.name}</Text>
                <Text style={styles.meta}>
                  {surv.category} · {live ? `Expires in ${formatRemaining(msRemaining(surv))}` : 'Closed'}
                </Text>
              </View>
              <Pressable onPress={onClose} hitSlop={12}>
                <Text style={styles.close}>✕</Text>
              </Pressable>
            </View>

            <Text style={styles.question}>{surv.question}</Text>

            {live && !myVote && !isMine ? (
              <>
                <Text style={styles.section}>Cast your vote</Text>
                {surv.options.map((opt) => (
                  <Pressable key={opt.id} style={styles.voteBtn} onPress={() => castVote(surv.id, opt.id)}>
                    <Text style={styles.voteText}>{opt.label}</Text>
                    {opt.why ? <Text style={styles.voteWhy}>{opt.why}</Text> : null}
                  </Pressable>
                ))}
              </>
            ) : (
              <>
                <Text style={styles.section}>SAGEmeter (weighted)</Text>
                {results.map((r) => (
                  <SageBar
                    key={r.optionId}
                    pct={r.pct}
                    label={r.label}
                    mine={myVote?.optionId === r.optionId}
                    acted={surv.actedOptionId === r.optionId}
                  />
                ))}
              </>
            )}

            {isMine && live && (
              <Pressable style={styles.extendBtn} onPress={() => extendSurv(surv.id, 24 * HOUR)}>
                <Text style={styles.extendText}>⏳ Extend countdown +24 hrs</Text>
              </Pressable>
            )}

            {isMine && (
              <Pressable
                style={styles.shareBtn}
                onPress={() => {
                  const url = survShareUrl(surv, me.name);
                  doShare(
                    url
                      ? `🦉 SURV me — help me decide: “${surv.question}”\n${url}`
                      : `🦉 SURV me — help me decide: “${surv.question}” (open SURV to vote)`,
                  );
                }}
              >
                <Text style={styles.shareText}>📤 Share with your Nest</Text>
              </Pressable>
            )}

            {!isMine && myVote && (
              <Pressable
                style={styles.shareBtn}
                onPress={() => {
                  const opt = surv.options.find((o) => o.id === myVote.optionId);
                  const url = voteBackUrl({ survId: surv.id, optionId: myVote.optionId, voterName: me.name });
                  doShare(
                    url
                      ? `🦉 I voted “${opt?.label}” on your SURV — tap to count it:\n${url}`
                      : `🦉 I voted “${opt?.label}” on your SURV`,
                  );
                }}
              >
                <Text style={styles.shareText}>📨 Send my vote to {asker?.name}</Text>
              </Pressable>
            )}
            {shareNote && <Text style={styles.hint}>{shareNote}</Text>}

            {needsDecision && (
              <>
                <Text style={styles.section}>Time to decide — what did you do?</Text>
                {winner && (
                  <Text style={styles.hint}>Your sphere says: {winner.label} ({winner.pct.toFixed(1)}%)</Text>
                )}
                {surv.options.map((opt) => (
                  <Pressable key={opt.id} style={styles.actBtn} onPress={() => actOn(surv.id, opt.id)}>
                    <Text style={styles.actText}>I went with: {opt.label}</Text>
                  </Pressable>
                ))}
              </>
            )}

            {surv.votes.length > 0 && (
              <>
                <Text style={styles.section}>Who weighed in</Text>
                {surv.votes.map((v) => {
                  const voter = userById(v.userId);
                  const opt = surv.options.find((o) => o.id === v.optionId);
                  return (
                    <View key={`${v.userId}_${v.votedAt}`} style={styles.voterRow}>
                      <Text style={{ fontSize: 18 }}>{voter?.avatar}</Text>
                      <Text style={styles.voterName}>{v.userId === me.id ? 'You' : voter?.name}</Text>
                      <Text style={styles.voterChoice} numberOfLines={1}>→ {opt?.label}</Text>
                      <View style={styles.weightPill}>
                        <Text style={styles.weightText}>×{displayWeight(v.weight)}</Text>
                      </View>
                    </View>
                  );
                })}
                <Text style={styles.hint}>
                  Weights blend Clout, category SAGE, Nest closeness, and how often each
                  person has steered you right before.
                </Text>
              </>
            )}

            <Text style={styles.section}>Round Table</Text>
            {(surv.comments ?? []).map((c) => {
              const author = userById(c.userId);
              return (
                <View key={c.id} style={styles.commentRow}>
                  <Text style={{ fontSize: 18 }}>{author?.avatar}</Text>
                  <View style={styles.commentBubble}>
                    <View style={styles.commentHead}>
                      <Text style={styles.commentAuthor}>
                        {c.userId === me.id ? 'You' : author?.name}
                      </Text>
                      <Text style={styles.commentTime}>{timeAgo(c.at)}</Text>
                    </View>
                    <Text style={styles.commentText}>{c.text}</Text>
                  </View>
                </View>
              );
            })}
            {(surv.comments ?? []).length === 0 && (
              <Text style={styles.hint}>No talk yet — say why you’d choose what you chose.</Text>
            )}
            {typingName && (
              <Text style={styles.typing}>{typingName} is typing…</Text>
            )}
            <View style={styles.commentInputRow}>
              <TextInput
                style={styles.commentInput}
                placeholder="Add to the Round Table…"
                placeholderTextColor={colors.inkFaint}
                value={comment}
                onChangeText={onCommentChange}
                onSubmitEditing={() => {
                  addComment(surv.id, comment);
                  setComment('');
                }}
              />
              <Pressable
                style={styles.commentSend}
                onPress={() => {
                  addComment(surv.id, comment);
                  setComment('');
                }}
              >
                <Text style={styles.commentSendText}>Post</Text>
              </Pressable>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(10,22,36,0.72)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.panel, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '88%' },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  avatar: { fontSize: 30 },
  asker: { color: colors.owlDeep, fontWeight: '800', fontSize: 16 },
  meta: { color: colors.inkSoft, fontSize: 12.5 },
  close: { color: colors.inkSoft, fontSize: 20, fontWeight: '700' },
  question: { color: colors.ink, fontSize: 18, fontWeight: '800', lineHeight: 24, marginBottom: 6 },
  section: { color: colors.inkSoft, fontWeight: '800', fontSize: 12.5, marginTop: 14, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  voteBtn: { backgroundColor: colors.white, borderRadius: radius.button, borderWidth: 1, borderColor: colors.chip, padding: 12, marginBottom: 7 },
  voteText: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  voteWhy: { color: colors.inkSoft, fontSize: 12, marginTop: 2 },
  actBtn: { backgroundColor: colors.owl, borderRadius: radius.button, padding: 12, marginBottom: 7 },
  actText: { color: colors.white, fontWeight: '800', fontSize: 14.5 },
  hint: { color: colors.inkSoft, fontSize: 12.5, marginBottom: 8, fontStyle: 'italic' },
  voterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  voterName: { color: colors.ink, fontWeight: '700', fontSize: 13.5 },
  voterChoice: { color: colors.inkSoft, fontSize: 12.5, flex: 1 },
  weightPill: { backgroundColor: colors.sage, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 },
  weightText: { color: colors.navy, fontWeight: '800', fontSize: 12 },
  extendBtn: {
    backgroundColor: colors.panelDeep,
    borderRadius: radius.button,
    paddingVertical: 9,
    alignItems: 'center',
    marginTop: 10,
  },
  extendText: { color: colors.inkSoft, fontWeight: '700', fontSize: 13 },
  shareBtn: {
    backgroundColor: colors.owlDeep,
    borderRadius: radius.button,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
  },
  shareText: { color: colors.white, fontWeight: '800', fontSize: 13.5 },
  commentRow: { flexDirection: 'row', gap: 8, marginBottom: 8, alignItems: 'flex-start' },
  commentBubble: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.chip,
    padding: 9,
  },
  commentHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  commentAuthor: { color: colors.owlDeep, fontWeight: '800', fontSize: 12.5 },
  commentTime: { color: colors.inkFaint, fontSize: 10.5 },
  typing: { color: colors.inkSoft, fontSize: 12, fontStyle: 'italic', marginBottom: 5 },
  commentText: { color: colors.ink, fontSize: 13.5, marginTop: 2, lineHeight: 18 },
  commentInputRow: { flexDirection: 'row', gap: 7, marginTop: 4 },
  commentInput: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.chip,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.ink,
  },
  commentSend: {
    backgroundColor: colors.owl,
    borderRadius: radius.button,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  commentSendText: { color: colors.white, fontWeight: '800', fontSize: 13.5 },
});
