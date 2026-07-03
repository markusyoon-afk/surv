// Feed card: question, countdown, weighted SAGEmeter bars, inline voting.

import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Tap } from './Tap';
import { OwlAvatar } from './OwlAvatar';
import { formatRemaining, msRemaining, tally } from '../engine/sage';
import { useSurv } from '../engine/store';
import type { Surv } from '../engine/types';
import { CATEGORY_ICONS, CATEGORY_LABELS, colors, radius } from '../theme';

export function SageBar({ pct, label, mine, acted }: { pct: number; label: string; mine?: boolean; acted?: boolean }) {
  return (
    <View style={styles.barRow}>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(pct, 2)}%` }, acted && styles.barActed]} />
        <Text style={styles.barLabel} numberOfLines={1}>
          {acted ? '✓ ' : ''}{label}{mine ? '  · your vote' : ''}
        </Text>
      </View>
      <Text style={styles.barPct}>{pct.toFixed(1)}%</Text>
    </View>
  );
}

export function SurvCard({ surv, onOpen }: { surv: Surv; onOpen: (surv: Surv) => void }) {
  const { me, userById, castVote, actOn, grade, owlStyle } = useSurv();
  const [impact, setImpact] = React.useState<string | null>(null);
  const asker = userById(surv.askerId);
  const myVote = surv.votes.find((v) => v.userId === me.id);
  const isMine = surv.askerId === me.id;
  const live = surv.status === 'live' && msRemaining(surv) > 0;
  const results = tally(surv);
  const showResults = !!myVote || isMine || !live;
  const needsAct = isMine && !live && surv.status === 'deciding';
  const needsVerdict = isMine && surv.status === 'acted';

  const doGrade = (outcome: 'good' | 'bad') => {
    const summary = grade(surv.id, outcome);
    if (summary) {
      setImpact(summary);
      setTimeout(() => setImpact(null), 7000);
    }
  };

  return (
    <Tap style={styles.card} onPress={() => onOpen(surv)}>
      <View style={styles.header}>
        <OwlAvatar
          clout={asker?.clout ?? 45}
          size={30}
          variantOf={surv.askerId}
          styleCfg={isMine ? owlStyle : undefined}
        />
        <View style={{ flex: 1 }}>
          <Text style={styles.asker}>{isMine ? 'You' : asker?.name}</Text>
          <View style={styles.metaRow}>
            <Ionicons
              name={CATEGORY_ICONS[surv.category] as keyof typeof Ionicons.glyphMap}
              size={11}
              color={colors.inkFaint}
            />
            <Text style={styles.meta}>
              {CATEGORY_LABELS[surv.category]} ·{' '}
              {live ? `${formatRemaining(msRemaining(surv))} left` : statusLabel(surv)}
            </Text>
          </View>
        </View>
        <View style={[styles.scopePill, surv.audience.kind === 'public' ? styles.scopeForest : styles.scopeTree]}>
          <Text style={styles.scopePillText}>
            {surv.audience.kind === 'public' ? '🌲 Forest' : '🌳 Tree'}
          </Text>
        </View>
        {live && <View style={styles.liveDot} />}
      </View>

      <Text style={styles.question}>{surv.question}</Text>

      {showResults
        ? results.map((r) => (
            <SageBar
              key={r.optionId}
              pct={r.pct}
              label={r.label}
              mine={myVote?.optionId === r.optionId}
              acted={surv.actedOptionId === r.optionId}
            />
          ))
        : surv.options.map((opt) => (
            <Tap
              key={opt.id}
              style={styles.voteBtn}
              onPress={() => castVote(surv.id, opt.id)}
            >
              <Text style={styles.voteBtnText}>{opt.label}</Text>
              {opt.why ? <Text style={styles.voteWhy}>{opt.why}</Text> : null}
            </Tap>
          ))}

      {needsAct && (
        <View style={styles.actRow}>
          <Text style={styles.actLabel}>⏳ Flight’s over — what did you do?</Text>
          <View style={styles.actBtns}>
            {surv.options.map((opt) => (
              <Tap key={opt.id} style={styles.actBtn} onPress={() => actOn(surv.id, opt.id)}>
                <Text style={styles.actBtnText} numberOfLines={1}>{opt.label}</Text>
              </Tap>
            ))}
          </View>
        </View>
      )}

      {needsVerdict && (
        <View style={styles.verdictRow}>
          <Text style={styles.actLabel}>How did it turn out?</Text>
          <View style={styles.verdictBtns}>
            <Tap style={[styles.verdictBtn, styles.goodBtn]} onPress={() => doGrade('good')}>
              <Text style={styles.verdictText}>👍 Good call</Text>
            </Tap>
            <Tap style={[styles.verdictBtn, styles.badBtn]} onPress={() => doGrade('bad')}>
              <Text style={styles.verdictText}>👎 Bad call</Text>
            </Tap>
          </View>
        </View>
      )}

      {impact && <Text style={styles.impact}>{impact}</Text>}

      <Text style={styles.footer}>
        {surv.votes.length} vote{surv.votes.length === 1 ? '' : 's'}
        {showResults ? ' · weighted by SAGE' : ' · vote to see the SAGEmeter'}
      </Text>
    </Tap>
  );
}

function statusLabel(surv: Surv): string {
  if (surv.status === 'graded') return surv.outcome === 'good' ? 'Good call ✓' : 'Bad call ✗';
  if (surv.status === 'acted') return 'Acted — awaiting verdict';
  return 'Expired — deciding';
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.panel,
    borderRadius: radius.card,
    padding: 14,
    marginHorizontal: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.hairline,
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8 },
  avatar: { fontSize: 26 },
  asker: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  meta: { color: colors.inkFaint, fontSize: 11.5, fontWeight: '500' },
  liveDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.good },
  scopePill: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3, marginRight: 6 },
  scopeTree: { backgroundColor: 'rgba(58,165,135,0.14)' },
  scopeForest: { backgroundColor: 'rgba(30,90,140,0.14)' },
  scopePillText: { fontSize: 10, fontWeight: '700', color: colors.inkSoft },
  question: { color: colors.ink, fontSize: 16, fontFamily: 'SpaceGrotesk_500Medium', marginBottom: 10, lineHeight: 21 },
  barRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 7, gap: 8 },
  barTrack: {
    flex: 1,
    height: 30,
    backgroundColor: colors.panelDeep,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  barFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: colors.sageBar,
    borderRadius: 8,
  },
  barActed: { backgroundColor: colors.owl },
  barLabel: { color: colors.ink, fontSize: 13, fontWeight: '600', paddingHorizontal: 10 },
  barPct: { color: colors.owlDeep, fontWeight: '800', fontSize: 14, width: 52, textAlign: 'right' },
  voteBtn: {
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.chip,
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 7,
  },
  voteBtnText: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  voteWhy: { color: colors.inkSoft, fontSize: 12, marginTop: 2 },
  footer: { color: colors.inkFaint, fontSize: 12, marginTop: 4 },
  actRow: { marginTop: 4, marginBottom: 4 },
  actLabel: { color: colors.owlDeep, fontWeight: '800', fontSize: 12.5, marginBottom: 6 },
  actBtns: { gap: 6 },
  actBtn: { backgroundColor: colors.owl, borderRadius: radius.button, paddingVertical: 8, paddingHorizontal: 12 },
  actBtnText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  verdictRow: { marginTop: 4, marginBottom: 4 },
  verdictBtns: { flexDirection: 'row', gap: 8 },
  verdictBtn: { flex: 1, borderRadius: radius.button, paddingVertical: 10, alignItems: 'center' },
  goodBtn: { backgroundColor: '#dcefdf' },
  badBtn: { backgroundColor: '#f3ddd8' },
  verdictText: { color: colors.ink, fontWeight: '800', fontSize: 13.5 },
  impact: { color: colors.owlDeep, fontWeight: '700', fontSize: 12.5, marginTop: 6 },
});
