import React, { useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../config';
import { clearLog, getLog, onLog, type LogEntry } from '../shopping/log';
import { MODES, type Mode } from '../shopping/modes';
import { MARKETS, type MarketId } from '../market';

function Sheet({ visible, title, onClose, children, action }: { visible: boolean; title: string; onClose: () => void; children: React.ReactNode; action?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} accessibilityLabel="Close" />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <View style={s.sheetHead}>
          <Text style={s.sheetTitle}>{title}</Text>
          <View style={s.row}>
            {action}
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
              <Text style={s.link}>Done</Text>
            </Pressable>
          </View>
        </View>
        {children}
      </View>
    </Modal>
  );
}

/** Settings: where hydration gets its data. Picking a mode reloads the page, so the next products use it. */
export function ModeSheet({
  visible,
  mode,
  market,
  onPick,
  onPickMarket,
  onClose,
}: {
  visible: boolean;
  mode: Mode;
  market: MarketId;
  onPick: (m: Mode) => void;
  onPickMarket: (m: MarketId) => void;
  onClose: () => void;
}) {
  return (
    <Sheet visible={visible} title="Product data" onClose={onClose}>
      <Text style={s.sectionTitle}>Country</Text>
      <Text style={s.help}>Firework’s catalog stays in EUR. The country picks the store’s price list and currency. Each country has its own cart, so switching empties it.</Text>
      <View style={s.chips} accessibilityRole="radiogroup">
        {MARKETS.map((m) => (
          <Pressable key={m.id} onPress={() => onPickMarket(m.id)} style={[s.marketChip, m.id === market && s.marketChipOn]} accessibilityRole="radio" accessibilityState={{ checked: m.id === market }}>
            <Text style={[s.marketChipText, m.id === market && s.marketChipTextOn]}>{m.label}</Text>
          </Pressable>
        ))}
      </View>
      <Text style={s.sectionTitle}>Data</Text>
      <Text style={s.help}>Where the app gets prices and stock when Firework asks (product hydration). Then open a video again.</Text>
      {MODES.map((m) => (
        <Pressable key={m.id} onPress={() => onPick(m.id)} style={[s.option, m.id === mode && s.optionOn]} accessibilityRole="radio" accessibilityState={{ checked: m.id === mode }}>
          <View style={[s.radio, m.id === mode && s.radioOn]} />
          <View style={{ flex: 1 }}>
            <Text style={s.optionLabel}>{m.label}</Text>
            <Text style={s.optionDetail}>{m.detail}</Text>
          </View>
        </Pressable>
      ))}
    </Sheet>
  );
}

const time = (d: Date) => d.toTimeString().slice(0, 8);

function Entry({ e }: { e: LogEntry }) {
  return (
    <View style={s.entry}>
      <Text style={s.entryHead}>
        {time(e.at)} · {e.title}
        {e.ms !== undefined ? ` · ${e.ms} ms` : ''}
      </Text>
      {e.video ? <Text style={s.entryMeta} numberOfLines={1}>Video: {e.video}</Text> : null}
      {e.request ? <Text style={s.entryMeta}>{e.request}</Text> : null}
      {e.lines.map((l, i) => (
        <Text key={i} style={[s.entryLine, !l.ok && { color: colors.danger }]}>
          {l.ok ? '✓' : '✗'} {l.text}
        </Text>
      ))}
      {e.note ? <Text style={s.entryMeta}>{e.note}</Text> : null}
    </View>
  );
}

/** The log: every time Firework asked the app something (product data, Add to cart) and what the app answered. */
export function LogSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [entries, setEntries] = useState(getLog());
  useEffect(() => onLog(setEntries), []);
  return (
    <Sheet
      visible={visible}
      title="Log"
      onClose={onClose}
      action={
        entries.length ? (
          <Pressable onPress={clearLog} hitSlop={12} accessibilityRole="button" style={{ marginRight: 20 }}>
            <Text style={s.link}>Clear</Text>
          </Pressable>
        ) : null
      }
    >
      <FlatList
        style={{ maxHeight: 460 }}
        data={entries}
        keyExtractor={(e, i) => `${e.at.getTime()}-${i}`}
        renderItem={({ item }) => <Entry e={item} />}
        ListEmptyComponent={<Text style={s.help}>Nothing yet. Open a video with products: Firework then asks the app for their details. Add to cart and purchases show here too.</Text>}
      />
    </Sheet>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(20,33,43,0.35)' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 14 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center' },
  link: { color: colors.fjord, fontSize: 16, fontWeight: '600' },
  help: { color: colors.inkSoft, fontSize: 14, lineHeight: 20, marginBottom: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.ink, marginTop: 4, marginBottom: 2 },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  marketChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: colors.mist, backgroundColor: colors.paper },
  marketChipOn: { backgroundColor: colors.fjord, borderColor: colors.fjord },
  marketChipText: { fontSize: 14, fontWeight: '600', color: colors.ink },
  marketChipTextOn: { color: colors.white },
  option: { flexDirection: 'row', gap: 12, padding: 12, borderRadius: 10, marginBottom: 6, backgroundColor: colors.paper },
  optionOn: { backgroundColor: colors.mist },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.inkSoft, marginTop: 2 },
  radioOn: { borderColor: colors.fjord, backgroundColor: colors.fjord },
  optionLabel: { fontSize: 15, fontWeight: '600', color: colors.ink },
  optionDetail: { fontSize: 13, color: colors.inkSoft, marginTop: 2, lineHeight: 18 },
  entry: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.mist },
  entryHead: { fontSize: 14, fontWeight: '700', color: colors.ink },
  entryMeta: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  entryLine: { fontSize: 13, color: colors.ink, marginTop: 3 },
});
