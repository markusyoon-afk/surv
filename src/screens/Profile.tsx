// Profile — SAGEmeter (Clout), category SAGE, the Verdict deck (swipe right = good
// call, left = bad call — the learning step), and connected sources.

import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { AVATAR_STAGES, nextStage, OWL_ACCESSORIES, OWL_PALETTES, OWL_RINGS, OWL_SHAPES, OwlAvatar, stageForClout } from '../components/OwlAvatar';
import { Image } from 'react-native';
import { useSurv } from '../engine/store';
import { CLAUDE_KEY_STORAGE } from '../engine/suggest';
import { inviteUrl, shareText } from '../lib/share';
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
  const { me, survs, toggleConnector, resetDemo, owlStyle, setOwlStyle } = useSurv();
  const pending = survs.filter((s) => s.askerId === me.id && s.status === 'acted');
  const graded = survs.filter((s) => s.askerId === me.id && s.status === 'graded');
  const sageEntries = Object.entries(me.categorySage) as Array<[string, number]>;

  return (
    <ScrollView
      contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.card}>
        <View style={styles.meRow}>
          <OwlAvatar clout={me.clout} size={64} showLabel styleCfg={owlStyle} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{me.name}</Text>
            <Text style={styles.bio}>{me.bio}</Text>
          </View>
          <Pressable
            style={styles.inviteBtn}
            onPress={() =>
              shareText(
                `🦉 Be part of my daily decisions — I'm on SURV, where my circle helps me decide the everyday stuff (and we all get wiser doing it): ${inviteUrl(me.name)}`,
              )
            }
          >
            <Text style={styles.inviteBtnText}>＋ Invite</Text>
          </Pressable>
        </View>
        <Text style={styles.section}>SAGEmeter</Text>
        <View style={styles.meterTrack}>
          <View style={[styles.meterFill, { width: `${me.clout}%` }]} />
          <Text style={styles.meterText}>{Math.round(me.clout)}%</Text>
        </View>
        <View style={styles.evoTrack}>
          {AVATAR_STAGES.map((s) => {
            const current = stageForClout(me.clout).stage === s.stage;
            const reached = me.clout >= s.minClout;
            return (
              <View key={s.stage} style={styles.evoStop}>
                <View style={[styles.evoRing, current && styles.evoRingOn, !reached && { opacity: 0.35 }]}>
                  <Image source={s.img} style={{ width: 34, height: 34 }} />
                </View>
                <Text style={[styles.evoPct, current && styles.evoPctOn]}>{s.minClout}%</Text>
              </View>
            );
          })}
        </View>
        <Text style={styles.evolution}>
          {(() => {
            const stage = stageForClout(me.clout);
            const next = nextStage(me.clout);
            const meaning: Record<number, string> = {
              1: 'Hatchling — learning whose advice to trust.',
              2: 'Owl — a trusted voice; your votes carry real weight.',
              3: 'Sage — a category authority your Nest leans on.',
              4: 'Masked Sage — guardian of good calls across circles.',
              5: 'Super Sage — legendary. Your word moves Nests.',
            };
            return next
              ? `${meaning[stage.stage]} Evolve into ${next.label} at ${next.minClout}% — every good call you influence gets you closer.`
              : `${meaning[5]} Maximum evolution reached.`;
          })()}
        </Text>
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
        <Text style={styles.section}>Integrations — your life’s ecosystem</Text>
        <Text style={styles.hint}>
          Every connection makes decisions smarter. Tap to connect — “yes” turns the
          signal on. (Live OAuth per service lands with the backend; calendar and
          location are real today, health is simulated until the device APIs connect.)
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
          <HealthToggle />
        </View>
      </View>

      <SageAlgorithmCard />

      <View style={styles.card}>
        <Text style={styles.section}>Customize your owl</Text>
        <Text style={styles.hint}>
          The stage is earned and never changes — but your owl is yours. New gear
          unlocks as your SAGEmeter grows.
        </Text>
        <Text style={styles.customLabel}>Owl color</Text>
        <View style={styles.connectors}>
          {OWL_PALETTES.map((p) => (
            <Pressable
              key={p.id}
              style={[styles.swatch, (owlStyle.palette ?? 'g') === p.id && styles.swatchOn]}
              onPress={() => setOwlStyle({ ...owlStyle, palette: p.id })}
            >
              <Text style={styles.swatchText}>{p.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.customLabel}>Owl shape</Text>
        <View style={styles.connectors}>
          {OWL_SHAPES.map((s) => (
            <Pressable
              key={s.id}
              style={[styles.swatch, (owlStyle.shape ?? 'round') === s.id && styles.swatchOn]}
              onPress={() => setOwlStyle({ ...owlStyle, shape: s.id })}
            >
              <Text style={styles.swatchText}>{s.label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.customLabel}>Ring</Text>
        <View style={styles.connectors}>
          {OWL_RINGS.map((r) => {
            const locked = me.clout < r.min;
            const on = (owlStyle.ring ?? 'none') === r.id;
            return (
              <Pressable
                key={r.id}
                style={[styles.swatch, { borderColor: r.color === 'transparent' ? colors.chip : r.color }, on && styles.swatchOn, locked && { opacity: 0.35 }]}
                onPress={() => !locked && setOwlStyle({ ...owlStyle, ring: r.id })}
              >
                <Text style={styles.swatchText}>{locked ? `🔒 ${r.min}%` : r.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.customLabel}>Accessory</Text>
        <View style={styles.connectors}>
          {OWL_ACCESSORIES.map((a) => {
            const locked = me.clout < a.min;
            const on = (owlStyle.accessory ?? 'none') === a.id;
            return (
              <Pressable
                key={a.id}
                style={[styles.swatch, on && styles.swatchOn, locked && { opacity: 0.35 }]}
                onPress={() => !locked && setOwlStyle({ ...owlStyle, accessory: a.id })}
              >
                <Text style={styles.swatchText}>
                  {locked ? `🔒 ${a.min}%` : `${a.emoji} ${a.label}`.trim()}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <ScheduleSettings />

      <NudgeSettings />

      <ClaudeSettings />

      <Pressable style={styles.reset} onPress={resetDemo}>
        <Text style={styles.resetText}>Reset demo data</Text>
      </Pressable>
    </ScrollView>
  );
}

function ScheduleSettings() {
  const { calendarEvents, importCalendar } = useSurv();
  const [ics, setIcs] = useState('');
  const [note, setNote] = useState<string | null>(null);
  const upcoming = calendarEvents.filter((e) => e.start > Date.now()).length;

  const doImport = () => {
    const count = importCalendar(ics);
    setNote(
      count > 0
        ? `Imported ${count} event${count === 1 ? '' : 's'} — they’ll appear as Quick SURV drafts.`
        : 'No events found — paste the full contents of a .ics file.',
    );
    if (count > 0) setIcs('');
  };

  return (
    <View style={styles.card}>
      <Text style={styles.section}>Schedule & Calendar</Text>
      <Text style={styles.hint}>
        SURV runs on the everyday rhythm — work, play, eat, sleep, exercise — and drafts
        your routine decisions at the right moment:
      </Text>
      <View style={styles.routineChips}>
        {['💼 Work 9–5 weekdays', '🍽️ Meals 7a · 12p · 6p', '🏋️ Exercise M/W/F 5p', '🎮 Play evenings + weekends', '😴 Sleep 11p–7a'].map(
          (r) => (
            <View key={r} style={styles.routineChip}>
              <Text style={styles.routineChipText}>{r}</Text>
            </View>
          ),
        )}
      </View>
      <Text style={styles.hint}>
        Add your real calendar: in Google Calendar use Settings → Export (or any app’s
        .ics export), open the file, and paste its contents here. Upcoming events become
        one-tap decision drafts. {upcoming > 0 ? `Currently tracking ${upcoming} upcoming event${upcoming === 1 ? '' : 's'}.` : ''}
      </Text>
      <TextInput
        style={styles.icsInput}
        placeholder="Paste .ics calendar contents here…"
        placeholderTextColor={colors.inkFaint}
        value={ics}
        onChangeText={setIcs}
        multiline
      />
      <Pressable style={[styles.claudeSave, { alignSelf: 'flex-start', paddingVertical: 8 }]} onPress={doImport}>
        <Text style={styles.claudeSaveText}>Import calendar</Text>
      </Pressable>
      {note && <Text style={styles.hint}>{note}</Text>}
    </View>
  );
}

function HealthToggle() {
  const { healthConnected, setHealthConnected } = useSurv();
  return (
    <Pressable
      style={[styles.connector, healthConnected && styles.connectorOn]}
      onPress={() => setHealthConnected(!healthConnected)}
    >
      <Text style={[styles.connectorText, healthConnected && styles.connectorTextOn]}>
        ❤️ Health (Apple/Google) {healthConnected ? '✓' : ''}
      </Text>
    </Pressable>
  );
}

function SageAlgorithmCard() {
  const { me } = useSurv();
  const [open, setOpen] = useState(false);
  // The secret sauce: developer eyes only.
  if (!/markus/i.test(me.name)) return null;
  return (
    <View style={styles.card}>
      <Pressable style={styles.algoHeader} onPress={() => setOpen(!open)}>
        <Text style={styles.section}>How the SAGEmeter works (dev only)</Text>
        <Text style={styles.algoToggle}>{open ? 'hide' : 'show'}</Text>
      </Pressable>
      {open && (
        <>
          <Text style={styles.algoFormula}>
            vote weight = 0.35·Clout + 0.35·CategorySAGE + 0.20·Closeness + 0.10·PairTrust
          </Text>
          <Text style={styles.hint}>
            Clout and CategorySAGE are 0–100 (you start at 30). Closeness: inner circle
            1.0 · regular 0.75 · outer 0.5 · public 0.3. PairTrust is 0–1 per person,
            starts 0.5.
          </Text>
          <Text style={styles.algoRow}>Verdict 👍 and you backed the picked option → CategorySAGE +4·gain·surprise, Clout +1, trust up</Text>
          <Text style={styles.algoRow}>Your option NOT picked → zero change, ever (fair-play rule, v2.1)</Text>
          <Text style={styles.algoRow}>Verdict 👎 and you backed the pick → CategorySAGE −3·crowd, Clout −1, trust down</Text>
          <Text style={styles.algoRow}>Verdict 👎 but you warned against it → CategorySAGE +2·gain·surprise, Clout +1</Text>
          <Text style={styles.algoRow}>Asker: 👍 → Clout +1 · 👎 → Clout −1 (you own the call)</Text>
          <Text style={styles.algoRow}>Arena: same rules, gentler steps (+3 aligned-good, −2 aligned-bad, 0 if not picked)</Text>
          <Text style={styles.hint}>
            Gains shrink as you climb (the (100−current)/70 factor), so a Super Sage is
            earned through a long record of good calls — full math in docs/SAGE-ALGORITHM.md.
          </Text>
        </>
      )}
    </View>
  );
}

function NudgeSettings() {
  const [status, setStatus] = useState<string>('default');

  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && 'Notification' in window) {
      setStatus(window.Notification.permission);
    } else {
      setStatus('unsupported');
    }
  }, []);

  if (status === 'unsupported') return null;

  const enable = () => {
    window.Notification.requestPermission().then(setStatus).catch(() => {});
  };

  return (
    <View style={styles.card}>
      <Text style={styles.section}>Verdict nudges</Text>
      {status === 'granted' ? (
        <Text style={styles.hint}>
          🔔 Nudges are on — SURV pings you the moment a decision needs your verdict.
        </Text>
      ) : (
        <>
          <Text style={styles.hint}>
            Get pinged when a countdown ends and a decision is waiting on you.
          </Text>
          <Pressable style={styles.claudeRemove} onPress={enable}>
            <Text style={styles.claudeRemoveText}>Enable nudges</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function ClaudeSettings() {
  const [key, setKey] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CLAUDE_KEY_STORAGE)
      .then((v) => setSaved(!!v))
      .catch(() => {});
  }, []);

  const save = () => {
    const trimmed = key.trim();
    if (!trimmed) return;
    AsyncStorage.setItem(CLAUDE_KEY_STORAGE, trimmed)
      .then(() => {
        setSaved(true);
        setKey('');
      })
      .catch(() => {});
  };

  const remove = () => {
    AsyncStorage.removeItem(CLAUDE_KEY_STORAGE)
      .then(() => setSaved(false))
      .catch(() => {});
  };

  return (
    <View style={styles.card}>
      <Text style={styles.section}>Claude AI</Text>
      {saved ? (
        <>
          <Text style={styles.hint}>
            ✨ Claude is connected — option suggestions are AI-generated on this device.
          </Text>
          <Pressable style={styles.claudeRemove} onPress={remove}>
            <Text style={styles.claudeRemoveText}>Disconnect Claude</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.hint}>
            Paste an Anthropic API key (console.anthropic.com) to turn ✨ Suggest options
            into live Claude generation. The key stays on this device only.
          </Text>
          <View style={styles.claudeRow}>
            <TextInput
              style={styles.claudeInput}
              placeholder="sk-ant-…"
              placeholderTextColor={colors.inkFaint}
              value={key}
              onChangeText={setKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
            />
            <Pressable style={styles.claudeSave} onPress={save}>
              <Text style={styles.claudeSaveText}>Connect</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
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
  evolution: { color: colors.inkSoft, fontSize: 12.5, fontStyle: 'italic', marginTop: 6 },
  evoTrack: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingHorizontal: 6 },
  evoStop: { alignItems: 'center', gap: 3 },
  evoRing: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  evoRingOn: { borderColor: colors.owl, backgroundColor: 'rgba(58,165,135,0.10)' },
  evoPct: { color: colors.inkFaint, fontSize: 10.5, fontWeight: '600' },
  evoPctOn: { color: colors.owlDeep, fontWeight: '800' },
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
  inviteBtn: {
    backgroundColor: colors.owl,
    borderRadius: radius.chip,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  inviteBtnText: { color: colors.white, fontWeight: '800', fontSize: 12.5 },
  reset: { alignItems: 'center', paddingVertical: 10 },
  resetText: { color: colors.star, fontSize: 12.5, textDecorationLine: 'underline' },
  customLabel: { color: colors.inkFaint, fontWeight: '700', fontSize: 11, marginTop: 8, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.5 },
  swatch: { borderWidth: 2, borderColor: colors.chip, backgroundColor: colors.white, borderRadius: radius.chip, paddingHorizontal: 11, paddingVertical: 6 },
  swatchOn: { backgroundColor: 'rgba(78,201,180,0.18)' },
  swatchText: { color: colors.ink, fontWeight: '600', fontSize: 12 },
  routineChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  routineChip: { backgroundColor: colors.panelDeep, borderRadius: radius.chip, paddingHorizontal: 10, paddingVertical: 6 },
  routineChipText: { color: colors.inkSoft, fontWeight: '700', fontSize: 12 },
  icsInput: {
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.chip,
    padding: 10,
    color: colors.ink,
    minHeight: 70,
    marginBottom: 8,
    fontSize: 12,
    textAlignVertical: 'top',
  },
  claudeRow: { flexDirection: 'row', gap: 7 },
  claudeInput: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: radius.button,
    borderWidth: 1,
    borderColor: colors.chip,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: colors.ink,
  },
  claudeSave: { backgroundColor: colors.owl, borderRadius: radius.button, paddingHorizontal: 14, justifyContent: 'center' },
  claudeSaveText: { color: colors.white, fontWeight: '800', fontSize: 13 },
  claudeRemove: { alignSelf: 'flex-start', backgroundColor: colors.panelDeep, borderRadius: radius.button, paddingHorizontal: 12, paddingVertical: 7 },
  claudeRemoveText: { color: colors.inkSoft, fontWeight: '700', fontSize: 12.5 },
  algoHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  algoToggle: { color: colors.owlDeep, fontWeight: '700', fontSize: 12 },
  algoFormula: {
    color: colors.ink,
    fontWeight: '700',
    fontSize: 12.5,
    backgroundColor: colors.panelDeep,
    borderRadius: 8,
    padding: 9,
    marginBottom: 8,
  },
  algoRow: { color: colors.inkSoft, fontSize: 12, marginBottom: 5, lineHeight: 16 },
});
