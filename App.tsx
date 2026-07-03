import { SpaceGrotesk_500Medium, SpaceGrotesk_700Bold, useFonts } from '@expo-google-fonts/space-grotesk';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Image, Platform, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Tap } from './src/components/Tap';
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
import { Sages } from './src/screens/Sages';
import { SurvDetail } from './src/screens/SurvDetail';
import { colors } from './src/theme';

type Tab = 'home' | 'new' | 'nests' | 'sages' | 'profile';

const TABS: Array<[Tab, keyof typeof Ionicons.glyphMap, string]> = [
  ['home', 'home', 'Tree'],
  ['new', 'add-circle', 'New SURV'],
  ['nests', 'people', 'Nests'],
  ['sages', 'trophy', 'Sages'],
  ['profile', 'person', 'You'],
];

const ONBOARDED_KEY = 'surv.onboarded.v1';

function Shell() {
  const [tab, setTab] = useState<Tab>('home');
  const [openSurv, setOpenSurv] = useState<Surv | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [importNotice, setImportNotice] = useState<string | null>(null);
  const [draft, setDraft] = useState<SurvDraft | null>(null);
  const { me, survs, sweepExpired, liveTick, setMyName, addAcquaintance, importSurv, importVote, hydrated, owlStyle } = useSurv();
  const dueForMe = survs.filter(
    (s) => s.askerId === me.id && (s.status === 'acted' || s.status === 'deciding'),
  ).length;

  // Minute heartbeat: countdowns refresh, expired SURVs flip to deciding, arena
  // results settle, and AI advisors weigh in on your live SURVs.
  const [, setTick] = useState(0);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showNotice = (text: string) => {
    setImportNotice(text);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = setTimeout(() => setImportNotice(null), 6000);
  };
  useEffect(() => {
    const timer = setInterval(() => {
      sweepExpired();
      const news = liveTick();
      if (news.length > 0) showNotice(news[0]);
      setTick((t) => t + 1);
    }, 30_000);
    return () => clearInterval(timer);
  }, [sweepExpired, liveTick]);

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
    if (payload.kind === 'invite') {
      addAcquaintance(payload.inviterName);
      setImportNotice(`🦉 ${payload.inviterName} invited you into their daily decisions — welcome to SURV.`);
    } else if (payload.kind === 'surv') {
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
        <View style={styles.frame}>
        <View style={styles.header}>
          <View style={styles.logoRow}>
            <OwlAvatar clout={me.clout} size={42} styleCfg={owlStyle} />
            <View>
              <Text style={styles.logo}>SURV</Text>
              <Text style={styles.tagline}>Live it! SURV it!</Text>
            </View>
          </View>
          <Tap style={styles.meterMini} onPress={() => setTab('profile')}>
            <View style={[styles.meterMiniFill, { width: `${me.clout}%` }]} />
            <Text style={styles.meterMiniText}>{Math.round(me.clout)}%</Text>
          </Tap>
        </View>

        {dueForMe > 0 && !nudgeDismissed && tab !== 'profile' && (
          <View style={styles.nudge}>
            <Ionicons name="notifications" size={15} color={colors.navy} />
            <Tap style={{ flex: 1 }} onPress={() => setTab('profile')}>
              <Text style={styles.nudgeText}>
                {dueForMe === 1 ? 'A decision needs' : `${dueForMe} decisions need`} your verdict —
                your Nest wants to know how it went
              </Text>
            </Tap>
            <Tap onPress={() => setNudgeDismissed(true)} hitSlop={10}>
              <Ionicons name="close" size={15} color={colors.navy} />
            </Tap>
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
          {tab === 'sages' && <Sages onOpen={setOpenSurv} />}
          {tab === 'profile' && (
            <Profile
              onDraft={(d) => {
                setDraft(d);
                setTab('new');
              }}
            />
          )}
        </View>

        <View style={styles.tabBar}>
          {TABS.map(([key, icon, label]) => {
            const active = tab === key;
            return (
              <Tap key={key} style={styles.tab} onPress={() => setTab(key)}>
                {key === 'home' ? (
                  <Image
                    source={require('./assets/icons/tree.png')}
                    style={[styles.tabImg, !active && styles.tabImgDim]}
                  />
                ) : key === 'nests' ? (
                  <Image
                    source={require('./assets/icons/nest.png')}
                    style={[styles.tabImg, !active && styles.tabImgDim]}
                  />
                ) : key === 'profile' ? (
                  <View style={!active && styles.tabImgDim}>
                    <OwlAvatar clout={me.clout} size={24} styleCfg={owlStyle} />
                  </View>
                ) : (
                  <Ionicons
                    name={active ? icon : (`${icon}-outline` as keyof typeof Ionicons.glyphMap)}
                    size={key === 'new' ? 26 : 22}
                    color={active ? colors.sage : colors.star}
                  />
                )}
                <Text style={[styles.tabLabel, active && styles.tabLabelOn]}>{label}</Text>
                {key === 'profile' && dueForMe > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{dueForMe}</Text>
                  </View>
                )}
              </Tap>
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
        </View>
      </SafeAreaView>
    </NightSky>
  );
}

/** Boot can never dead-end: crashes render a reload screen, not a blank. */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { broken: boolean }> {
  state = { broken: false };
  static getDerivedStateFromError() {
    return { broken: true };
  }
  render() {
    if (!this.state.broken) return this.props.children;
    return (
      <View style={bootStyles.wrap}>
        <Text style={{ fontSize: 44 }}>🦉</Text>
        <Text style={bootStyles.title}>A twig snapped.</Text>
        <Text style={bootStyles.body}>Something went wrong — one tap brings the Tree back.</Text>
        <Tap
          style={bootStyles.btn}
          onPress={() => {
            try {
              if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.reload();
              else this.setState({ broken: false });
            } catch {
              this.setState({ broken: false });
            }
          }}
        >
          <Text style={bootStyles.btnText}>Reload SURV</Text>
        </Tap>
      </View>
    );
  }
}

export default function App() {
  // Fonts must never block the app: proceed on load, on error, or after 2.5s.
  const [fontsLoaded, fontError] = useFonts({ SpaceGrotesk_500Medium, SpaceGrotesk_700Bold });
  const [fontPatience, setFontPatience] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setFontPatience(true), 2500);
    return () => clearTimeout(t);
  }, []);
  if (!fontsLoaded && !fontError && !fontPatience) {
    return <View style={{ flex: 1, backgroundColor: colors.night }} />;
  }
  return (
    <ErrorBoundary>
      <SurvProvider>
        <Shell />
      </SurvProvider>
    </ErrorBoundary>
  );
}

const bootStyles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.night, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  title: { color: colors.white, fontSize: 20, fontWeight: '700' },
  body: { color: colors.star, fontSize: 13.5, textAlign: 'center' },
  btn: { marginTop: 10, backgroundColor: colors.owl, borderRadius: 24, paddingVertical: 12, paddingHorizontal: 36 },
  btnText: { color: colors.white, fontWeight: '800', fontSize: 15 },
});

const styles = StyleSheet.create({
  safe: { flex: 1 },
  // Tablets/desktop read as a centered column, phones use the full width.
  frame: { flex: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
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
  logo: { color: colors.white, fontSize: 23, fontFamily: 'SpaceGrotesk_700Bold', letterSpacing: 2.5 },
  tagline: { color: colors.sage, fontSize: 9.5, fontFamily: 'SpaceGrotesk_500Medium', letterSpacing: 1.6, textTransform: 'uppercase' },
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
  tabImg: { width: 24, height: 24 },
  tabImgDim: { opacity: 0.5 },
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
