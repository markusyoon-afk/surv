import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { NightSky } from './src/components/NightSky';
import { Onboarding } from './src/components/Onboarding';
import { OwlAvatar } from './src/components/OwlAvatar';
import type { SurvDraft } from './src/engine/drafts';
import { clearShareHash, parseShareHash } from './src/lib/share';
import { SurvProvider, useSurv } from './src/engine/store';
import type { Surv } from './src/engine/types';
import { HomeFeed } from './src/screens/HomeFeed';
import { Nests } from './src/screens/Nests';
import { NewSurv } from './src/screens/NewSurv';
import { Profile } from './src/screens/Profile';
import { SurvDetail } from './src/screens/SurvDetail';
import { colors } from './src/theme';

type Tab = 'home' | 'new' | 'nests' | 'profile';

const TABS: Array<[Tab, keyof typeof Ionicons.glyphMap, string]> = [
  ['home', 'home', 'Tree'],
  ['new', 'add-circle', 'New SURV'],
  ['nests', 'people', 'Nests'],
  ['profile', 'person', 'You'],
];

const ONBOARDED_KEY = 'surv.onboarded.v1';

function Shell() {
  const [tab, setTab] = useState<Tab>('home');
  const [openSurv, setOpenSurv] = useState<Surv | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<SurvDraft | null>(null);
  const { me, survs, sweepExpired, setMyName, importSurv, importVote, hydrated } = useSurv();
  const dueForMe = survs.filter(
    (s) => s.askerId === me.id && (s.status === 'acted' || s.status === 'deciding'),
  ).length;

  // Minute heartbeat: countdown labels stay fresh and expired SURVs flip to deciding.
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      sweepExpired();
      setTick((t) => t + 1);
    }, 30_000);
    return () => clearInterval(timer);
  }, [sweepExpired]);

  // Verdict nudges: browser notification when something new needs your call.
  const prevDue = useRef(dueForMe);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  useEffect(() => {
    if (dueForMe > prevDue.current) {
      setNudgeDismissed(false);
      if (
        Platform.OS === 'web' &&
        typeof window !== 'undefined' &&
        'Notification' in window &&
        window.Notification.permission === 'granted'
      ) {
        try {
          new window.Notification('SURV 🦉', {
            body: 'A decision is waiting on you — act on it and swipe the verdict.',
          });
        } catch {
          // notification construction can throw on some platforms — nudge banner covers it
        }
      }
    }
    prevDue.current = dueForMe;
  }, [dueForMe]);

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDED_KEY)
      .then((v) => setShowOnboarding(!v))
      .catch(() => {});
  }, []);

  const dismissOnboarding = (name: string) => {
    setMyName(name);
    setShowOnboarding(false);
    AsyncStorage.setItem(ONBOARDED_KEY, 'y').catch(() => {});
  };

  // Incoming share links (web): #s= imports a friend's SURV, #v= lands a vote-back.
  useEffect(() => {
    if (!hydrated) return;
    const payload = parseShareHash();
    if (!payload) return;
    clearShareHash();
    if (payload.kind === 'surv') {
      const imported = importSurv(payload.packet);
      if (imported) {
        setOpenSurv(imported);
        setImportNotice(`${payload.packet.askerName} needs your vote 🦉`);
      }
    } else {
      const ok = importVote(payload.packet);
      setImportNotice(
        ok
          ? `${payload.packet.voterName}’s vote landed — SAGEmeter updated`
          : 'That vote was already counted (or the SURV isn’t on this device).',
      );
    }
    const t = setTimeout(() => setImportNotice(null), 5000);
    return () => clearTimeout(t);
  }, [hydrated]);

  return (
    <NightSky>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <OwlAvatar clout={me.clout} size={42} />
            <View>
              <Text style={styles.logo}>SURV</Text>
              <Text style={styles.tagline}>Live it! SURV it!</Text>
            </View>
          </View>
          <View style={styles.meterMini}>
            <View style={[styles.meterMiniFill, { width: `${me.clout}%` }]} />
            <Text style={styles.meterMiniText}>{Math.round(me.clout)}%</Text>
          </View>
        </View>

        {dueForMe > 0 && !nudgeDismissed && tab !== 'profile' && (
          <View style={styles.nudge}>
            <Ionicons name="notifications" size={15} color={colors.navy} />
            <Pressable style={{ flex: 1 }} onPress={() => setTab('profile')}>
              <Text style={styles.nudgeText}>
                {dueForMe === 1 ? 'A decision needs' : `${dueForMe} decisions need`} your verdict —
                your Nest wants to know how it went
              </Text>
            </Pressable>
            <Pressable onPress={() => setNudgeDismissed(true)} hitSlop={10}>
              <Ionicons name="close" size={15} color={colors.navy} />
            </Pressable>
          </View>
        )}

        <View style={{ flex: 1 }}>
          {tab === 'home' && (
            <HomeFeed
              onOpen={setOpenSurv}
              onDraft={(d) => {
                setDraft(d);
                setTab('new');
              }}
              onGoToProfile={() => setTab('profile')}
            />
          )}
          {tab === 'new' && (
            <NewSurv
              onPosted={() => setTab('home')}
              initialDraft={draft}
              onDraftConsumed={() => setDraft(null)}
            />
          )}
          {tab === 'nests' && <Nests />}
          {tab === 'profile' && <Profile />}
        </View>

        <View style={styles.tabBar}>
          {TABS.map(([key, icon, label]) => {
            const active = tab === key;
            return (
              <Pressable key={key} style={styles.tab} onPress={() => setTab(key)}>
                <Ionicons
                  name={active ? icon : (`${icon}-outline` as keyof typeof Ionicons.glyphMap)}
                  size={key === 'new' ? 26 : 22}
                  color={active ? colors.sage : colors.star}
                />
                <Text style={[styles.tabLabel, active && styles.tabLabelOn]}>{label}</Text>
                {key === 'profile' && dueForMe > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{dueForMe}</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>

        <SurvDetail
          surv={openSurv ? survs.find((s) => s.id === openSurv.id) ?? null : null}
          onClose={() => setOpenSurv(null)}
        />
        {importNotice && (
          <View style={styles.notice}>
            <Text style={styles.noticeText}>{importNotice}</Text>
          </View>
        )}
        {showOnboarding && <Onboarding defaultName={me.name} onDone={dismissOnboarding} />}
        <StatusBar style="light" />
      </SafeAreaView>
    </NightSky>
  );
}

export default function App() {
  return (
    <SurvProvider>
      <Shell />
    </SurvProvider>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 12,
  },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  owlBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.owl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: { color: colors.white, fontSize: 22, fontWeight: '800', letterSpacing: 3.5 },
  tagline: { color: colors.sage, fontSize: 10, fontWeight: '600', letterSpacing: 1.2, textTransform: 'uppercase' },
  meterMini: {
    width: 86,
    height: 24,
    backgroundColor: colors.nightCard,
    borderRadius: 12,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  meterMiniFill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.sage },
  meterMiniText: { color: colors.white, fontWeight: '800', fontSize: 11.5, textAlign: 'center' },
  tabBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: colors.navy,
    paddingBottom: 22,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.nightCard,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel: { color: colors.star, fontSize: 10, fontWeight: '600', letterSpacing: 0.2 },
  tabLabelOn: { color: colors.sage, fontWeight: '700' },
  badge: {
    position: 'absolute',
    top: -4,
    right: '26%',
    backgroundColor: colors.danger,
    borderRadius: 9,
    minWidth: 17,
    height: 17,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.white, fontSize: 10.5, fontWeight: '800' },
  notice: {
    position: 'absolute',
    top: 70,
    left: 20,
    right: 20,
    backgroundColor: colors.owl,
    borderRadius: 12,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
  noticeText: { color: colors.white, fontWeight: '800', fontSize: 13.5, textAlign: 'center' },
  nudge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.sage,
    marginHorizontal: 14,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  nudgeText: { color: colors.navy, fontWeight: '700', fontSize: 12.5 },
});
