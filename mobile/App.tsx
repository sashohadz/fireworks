/**
 * Fjordbloom workshop app: two pages with Firework (a video feed and a Storyblock), and product hydration from the
 * store's mock API. Plain state for the tabs: no navigation library, so fewer native modules to build.
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Banner } from './src/components/Notice';
import { LogSheet, ModeSheet } from './src/components/Sheets';
import { colors } from './src/config';
import { FeedScreen } from './src/screens/FeedScreen';
import { StoryblockScreen } from './src/screens/StoryblockScreen';
import { cartCount, clearCart, getCart, onCart } from './src/cart/cart';
import { catalogKey, getLanguage, getMarket, languageNames, setLanguage, setMarket, type Language, type MarketId } from './src/market';
import { addLog } from './src/shopping/log';
import { prefetchMarket } from './src/shopping/api';
import { CartScreen } from './src/screens/CartScreen';
import { applyPlayerLanguage, getInit, onInit } from './src/sdk';
import { getLog, onLog } from './src/shopping/log';
import { getMode, modeLabel, setMode, type Mode } from './src/shopping/modes';
import { getTab, onTab, openTab, type Tab } from './src/ui';

const TABS: { id: Tab; label: string }[] = [
  { id: 'feed', label: 'Video feed' },
  { id: 'storyblock', label: 'Storyblock' },
  { id: 'cart', label: 'Cart' },
];

function Shell() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>(getTab());
  const [inCart, setInCart] = useState(cartCount(getCart()));
  const [mode, setModeState] = useState<Mode>(getMode());
  const [market, setMarketState] = useState(getMarket());
  const [language, setLanguageState] = useState<Language>(getLanguage());
  const [reloadKey, setReloadKey] = useState(0);
  const [sheet, setSheet] = useState<'mode' | 'log' | null>(null);
  const [logCount, setLogCount] = useState(getLog().length);
  const [init, setInit] = useState(getInit());
  useEffect(() => onLog((e) => setLogCount(e.length)), []);
  useEffect(() => onInit(setInit), []);
  useEffect(() => onTab(setTab), []);
  useEffect(() => onCart((lines) => setInCart(cartCount(lines))), []);
  // The player's language is kept by the SDK across restarts; the product text's isn't. Line them up at start (a no-op
  // unless the last session ended in another language).
  useEffect(() => {
    applyPlayerLanguage(getLanguage());
  }, []);

  // Another country: another price list and currency, and its own cart. Reload the Firework components so the
  // player asks for the products again.
  const pickMarket = (id: MarketId) => {
    if (id === market.id) { return setSheet(null); }
    const before = getLanguage();
    setMarket(id);
    const next = getMarket();
    setMarketState(next);
    setLanguageState(getLanguage());
    clearCart();
    prefetchMarket(catalogKey()).catch(() => {});
    addLog({ at: new Date(), kind: 'cart', title: `Country: ${next.country}`, lines: [{ ok: true, text: `Prices in ${next.currency} from /api/${catalogKey()}/…; cart emptied` }] });
    setReloadKey((k) => k + 1);
    setSheet(null);
    // The country doesn't offer the language that was picked: back to English in the player too.
    if (getLanguage() !== before) { applyPlayerLanguage(getLanguage()); }
  };

  // Another language: the product text comes from /api/{market}/{lang}/… and Firework's buttons follow. Prices and the
  // cart stay (same country). changeAppLanguage goes last, as Firework's docs say: on Android it recreates the screen.
  const pickLanguage = (lang: Language) => {
    if (!setLanguage(lang)) { return setSheet(null); }
    setLanguageState(lang);
    prefetchMarket(catalogKey()).catch(() => {});
    addLog({ at: new Date(), kind: 'cart', title: `Language: ${languageNames[lang]}`, lines: [{ ok: true, text: lang === 'en' ? `Product text: Firework's catalog (English), prices from /api/${market.id}/…` : `Name, subtitle and description from /api/${catalogKey()}/…; player buttons in ${languageNames[lang]}` }] });
    setReloadKey((k) => k + 1);
    setSheet(null);
    applyPlayerLanguage(lang);
  };

  const pick = (m: Mode) => {
    setMode(m);
    setModeState(m);
    setReloadKey((k) => k + 1); // reload the page's Firework component, so new products are asked for again
    setSheet(null);
  };

  return (
    <View style={[s.app, { paddingTop: insets.top }]}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.paper} />
      <View style={s.header}>
        <View>
          <Text style={s.brand}>Fjordbloom</Text>
          <Text style={s.sub}>Firework mobile SDK workshop</Text>
        </View>
        <View style={s.actions}>
          <Pressable onPress={() => setSheet('mode')} style={s.chip} accessibilityRole="button" accessibilityLabel={`Country ${market.country}, language ${languageNames[language]}, product data: ${modeLabel(mode)}`}>
            <Text style={s.chipText}>
              {market.id.toUpperCase()}{language === 'en' ? '' : `-${language}`} · {modeLabel(mode)}
            </Text>
          </Pressable>
          <Pressable onPress={() => setSheet('log')} style={s.chip} accessibilityRole="button" accessibilityLabel={`Hydration log, ${logCount} entries`}>
            <Text style={s.chipText}>Log {logCount ? `(${logCount})` : ''}</Text>
          </Pressable>
        </View>
      </View>
      {init.status === 'failed' && <Banner tone="error">Firework didn’t start: {init.reason}. Check fw.appId and fw.packageName in android/firework.local.properties.</Banner>}

      <View style={{ flex: 1 }}>
        {tab === 'feed' ? <FeedScreen reloadKey={reloadKey} /> : tab === 'storyblock' ? <StoryblockScreen reloadKey={reloadKey} /> : <CartScreen />}
      </View>

      <View style={[s.tabs, { paddingBottom: insets.bottom }]} accessibilityRole="tablist">
        {TABS.map((t) => (
          <Pressable key={t.id} onPress={() => openTab(t.id)} style={s.tab} accessibilityRole="tab" accessibilityState={{ selected: tab === t.id }}>
            <View style={[s.tabMark, tab === t.id && s.tabMarkOn]} />
            <Text style={[s.tabText, tab === t.id && s.tabTextOn]}>
              {t.label}
              {t.id === 'cart' && inCart ? ` (${inCart})` : ''}
            </Text>
          </Pressable>
        ))}
      </View>

      <ModeSheet visible={sheet === 'mode'} mode={mode} market={market.id} language={language} onPick={pick} onPickMarket={pickMarket} onPickLanguage={pickLanguage} onClose={() => setSheet(null)} />
      <LogSheet visible={sheet === 'log'} onClose={() => setSheet(null)} />
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <Shell />
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.paper },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.mist },
  brand: { fontSize: 18, fontWeight: '800', color: colors.fjord, letterSpacing: 0.5 },
  sub: { fontSize: 12, color: colors.inkSoft },
  actions: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, backgroundColor: colors.white, borderWidth: 1, borderColor: colors.mist },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.ink },
  tabs: { flexDirection: 'row', backgroundColor: colors.white, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.mist },
  tab: { flex: 1, alignItems: 'center', paddingTop: 0, paddingBottom: 12, minHeight: 52 },
  tabMark: { height: 3, width: 40, borderRadius: 2, marginBottom: 9, backgroundColor: 'transparent' },
  tabMarkOn: { backgroundColor: colors.fjord },
  tabText: { fontSize: 14, fontWeight: '600', color: colors.inkSoft },
  tabTextOn: { color: colors.fjord },
});
