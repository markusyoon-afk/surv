// Profile — SAGEmeter (Clout), category SAGE, the Verdict deck (swipe right = good
// call, left = bad call — the learning step), and connected sources.

import React, { useRef } from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSurv } from '../engine/store';
import type { ConnectorId, Outcome } from '../engine/types';
import { colors, radius } from '../theme';

const CONNECTORS: Array<[ConnectorId, string]> = [
  ['facebook', '📘 Facebook'],
  ['instagram', '📸 Instagram'],
  ['discord', '🎮 Discord'],
  ['yelp', '🔴 Yelp'],
  ['google_reviews', '🟢 Google Reviews'],
];

export function Profile() {
  const { me, survs, toggleConnector, resetDemo } = useSurv();
  const pending = survs.filter((s) => s.askerId === me.id && s.status === 'acted');
  const graded = survs.filter((s) => s.askerId === me.id && s.status === 'graded');
  const sageEntries = Object.entries(me.categorySage) as Array<[string, number]>;

  return (
    <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 100 }}>
      <View style={styles.card}>
        <View style={styles.meRow}>
          <Text style={{ fontSize: 44 }}>{me.avatar}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{me.name}</Text>
            <Text style={styles.bio}>{me.bio}</Text>
          </View>
        </View>
        <Text style={styles.section}>SAGEmeter</Text>
        <View style={styles.meterTrack}>
          <View style={[styles.meterFill, { width: `${me.clout}%` }]} />
          <Text style={styles.meterText}>{Math.round(me.clout)}%</Text>
        </View>
        {sageEntries.length > 0 && (
          <>
            <Text style={styles.section}>Category SAGE</Text>
            {sageEntries
              .sort((a, b) => b[1] - a[1])
              .map(([category, value]) => (
                <View key={category} style={styles.sageRow}>
                  <Text style={styles.sageLabel}>{category}</Text>
                  <View style={styles.sageTrack}>
                    <View style={[styles.sageFill, { width: `${value}%` }]} />
                  </View>
                  <Text style={styles.sageValue}>{Math.round(value)}</Text>
                </View>
              ))}
          </>
        )}
      </View>

      {pending.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.section}>The Verdict — how did it turn out?</Text>
          <Text style={styles.hint}>
            Swipe right if it was a good call, left if it wasn’t. Your verdict retrains
            how much each voter counts for you next time.
          </Text>
          {pending.map((s) => (
            <VerdictCard key={s.id} survId={s.id} />
          ))}
        </View>
      )}

      {graded.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.section}>Decision history</Text>
          {graded.map((s) => {
            const acted = s.options.find((o) => o.id === s.actedOptionId);
            return (
              <View key={s.id} style={styles.historyRow}>
                <Text style={{ fontSize: 16 }}>{s.outcome === 'good' ? '👍' : '👎'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.historyQ} numberOfLines={1}>{s.question}</Text>
                  <Text style={styles.historyA}>You went with: {acted?.label}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={styles.card}>
        <Text style={styles.section}>Connected sources</Text>
        <Text style={styles.hint}>
          Sources feed option suggestions and Nest signals. (Live OAuth lands with the backend.)
        </Text>
        <View style={styles.connectors}>
          {CONNECTORS.map(([id, label]) => {
            const on = me.connectors.includes(id);
            return (
              <Pressable
                key={id}
                style={[styles.connector, on && styles.connectorOn]}
                onPress={() => toggleConnector(id)}
              >
                <Text style={[styles.connectorText, on && styles.connectorTextOn]}>
                  {label} {on ? '✓' : ''}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Pressable style={styles.reset} onPress={resetDemo}>
        <Text style={styles.resetText}>Reset demo data</Text>
      </Pressable>
    </ScrollView>
  );
}

function VerdictCard({ survId }: { survId: string }) {
  const { survs, grade } = useSurv();
  const surv = survs.find((s) => s.id === survId);
  const pan = useRef(new Animated.ValueXY()).current;

  const responder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) => Math.abs(g.dx) > 12,
      onPanResponderMove: Animated.event([null, { dx: pan.x }], { useNativeDriver: false }),
      onPanResponderRelease: (_e, g) => {
        if (Math.abs(g.dx) > 90) {
          const outcome: Outcome = g.dx > 0 ? 'good' : 'bad';
          Animated.timing(pan, {
            toValue: { x: g.dx > 0 ? 500 : -500, y: 0 },
            duration: 180,
            useNativeDriver: false,
          }).start(() => grade(survId, outcome));
        } else {
          Animated.spring(pan, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
        }
      },
    }),
  ).current;

  if (!surv) return null;
  const acted = surv.options.find((o) => o.id === surv.actedOptionId);
  const rotate = pan.x.interpolate({ inputRange: [-200, 0, 200], outputRange: ['-8deg', '0deg', '8deg'] });

  return (
    <Animated.View
      style={[styles.verdict, { transform: [{ translateX: pan.x }, { rotate }] }]}
      {...responder.panHandlers}
    >
      <Text style={styles.verdictQ}>{surv.question}</Text>
      <Text style={styles.verdictA}>You went with: {acted?.label}</Text>
      <View style={styles.verdictActions}>
        <Pressable style={[styles.verdictBtn, styles.bad]} onPress={() => grade(survId, 'bad')}>
          <Text style={styles.verdictBtnText}>👎 Bad call</Text>
        </Pressable>
        <Text style={styles.swipeHint}>← swipe →</Text>
        <Pressable style={[styles.verdictBtn, styles.good]} onPress={() => grade(survId, 'good')}>
          <Text style={styles.verdictBtnText}>👍 Good call</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: radius.card, padding: 14, marginBottom: 12 },
  meRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { color: colors.ink, fontWeight: '900', fontSize: 19 },
  bio: { color: colors.inkSoft, fontSize: 13, marginTop: 2 },
  section: { color: colors.inkSoft, fontWeight: '800', fontSize: 12.5, marginTop: 12, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  meterTrack: { height: 34, backgroundColor: colors.panelDeep, borderRadius: 10, overflow: 'hidden', justifyContent: 'center' },
  meterFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.owl, borderRadius: 10 },
  meterText: { color: colors.ink, fontWeight: '900', fontSize: 15, paddingHorizontal: 12 },
  sageRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  sageLabel: { color: colors.ink, fontWeight: '700', fontSize: 12.5, width: 100 },
  sageTrack: { flex: 1, height: 10, backgroundColor: colors.panelDeep, borderRadius: 5, overflow: 'hidden' },
  sageFill: { height: '100%', backgroundColor: colors.sageBar, borderRadius: 5 },
  sageValue: { color: colors.inkSoft, fontWeight: '800', fontSize: 12, width: 26, textAlign: 'right' },
  hint: { color: colors.inkSoft, fontSize: 12.5, fontStyle: 'italic', marginBottom: 8 },
  verdict: {
    backgroundColor: colors.white,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.chip,
    padding: 14,
    marginBottom: 10,
  },
  verdictQ: { color: colors.ink, fontWeight: '800', fontSize: 14.5 },
  verdictA: { color: colors.owlDeep, fontWeight: '700', fontSize: 13, marginTop: 4 },
  verdictActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  verdictBtn: { borderRadius: radius.button, paddingHorizontal: 14, paddingVertical: 8 },
  bad: { backgroundColor: '#f3ddd8' },
  good: { backgroundColor: '#dcefdf' },
  verdictBtnText: { fontWeight: '800', fontSize: 13, color: colors.ink },
  swipeHint: { color: colors.inkFaint, fontSize: 11.5 },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5 },
  historyQ: { color: colors.ink, fontWeight: '700', fontSize: 13.5 },
  historyA: { color: colors.inkSoft, fontSize: 12 },
  connectors: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  connector: { backgroundColor: colors.panelDeep, borderRadius: radius.chip, paddingHorizontal: 12, paddingVertical: 7 },
  connectorOn: { backgroundColor: colors.owl },
  connectorText: { color: colors.inkSoft, fontWeight: '700', fontSize: 12.5 },
  connectorTextOn: { color: colors.white },
  reset: { alignItems: 'center', paddingVertical: 10 },
  resetText: { color: colors.star, fontSize: 12.5, textDecorationLine: 'underline' },
});
