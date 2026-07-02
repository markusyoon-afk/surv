// SURV detail overlay: full results (weighted + raw), voter weights, countdown,
// and — for your own expired SURVs — the "Act on it" step.

import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SageBar } from '../components/SurvCard';
import { displayWeight, formatRemaining, msRemaining, tally, winningOption } from '../engine/sage';
import { useSurv } from '../engine/store';
import type { Surv } from '../engine/types';
import { colors, radius } from '../theme';

export function SurvDetail({ surv, onClose }: { surv: Surv | null; onClose: () => void }) {
  const { me, userById, castVote, actOn } = useSurv();
  if (!surv) return null;

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
});
