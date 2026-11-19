import React, { useEffect, useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { getCart, getLastAdded, onCart, type CartLine } from '../cart/cart';
import { cartSummary } from '../cart/rules';
import { afterSheetClosed, keepWatching, requestCheckout } from '../cart/sheet';
import { colors } from '../config';

const euro = (n: number) => `€${n.toFixed(2)}`;

function Sheet() {
  const insets = useSafeAreaInsets();
  const [lines, setLines] = useState<CartLine[]>(getCart());
  const [busy, setBusy] = useState(false);
  useEffect(() => onCart(setLines), []);
  // When Android destroys the popup's screen, React tears this tree down: the player is in front again by then, so
  // a pending Check out can now float it and open the Cart tab.
  useEffect(
    () => () => {
      afterSheetClosed();
    },
    [],
  );

  const added = lines.find((l) => l.unitId === getLastAdded());
  const sum = cartSummary(lines);

  const checkout = async () => {
    setBusy(true);
    await requestCheckout();
  };

  return (
    <View style={s.root}>
      <Pressable style={s.backdrop} onPress={keepWatching} accessibilityLabel="Keep watching" />
      <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
        <View style={s.grabber} />
        <Text style={s.title}>✓ Added to cart</Text>
        {added ? (
          <View style={s.added}>
            {added.image ? <Image source={{ uri: added.image }} style={s.thumb} /> : null}
            <View style={{ flex: 1 }}>
              <Text style={s.name} numberOfLines={2}>
                {added.name}
              </Text>
              <Text style={s.meta}>
                {added.unitName} · {euro(added.price)}
                {added.regularPrice > added.price ? <Text style={s.was}>  {euro(added.regularPrice)}</Text> : null}
              </Text>
            </View>
          </View>
        ) : null}

        <View style={s.cart}>
          <View style={s.cartHead}>
            <Text style={s.cartTitle}>
              Your cart · {sum.count} item{sum.count === 1 ? '' : 's'}
            </Text>
            <Text style={s.cartTotal}>{euro(sum.subtotal)}</Text>
          </View>
          {sum.shown.map((l) => (
            <View key={l.unitId} style={s.row}>
              <Text style={s.rowName} numberOfLines={1}>
                {l.name} ({l.unitName}) × {l.quantity}
              </Text>
              <Text style={s.rowPrice}>{euro(l.price * l.quantity)}</Text>
            </View>
          ))}
          {sum.more ? <Text style={s.more}>+ {sum.more} more</Text> : null}
        </View>

        <View style={s.actions}>
          <Pressable onPress={keepWatching} style={[s.btn, s.btnSecondary]} accessibilityRole="button">
            <Text style={[s.btnText, s.btnSecondaryText]}>Keep watching</Text>
          </Pressable>
          <Pressable onPress={checkout} disabled={busy} style={[s.btn, s.btnPrimary, busy && s.btnBusy]} accessibilityRole="button">
            <Text style={[s.btnText, s.btnPrimaryText]}>{busy ? 'Opening cart…' : 'Check out'}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

/**
 * The "Added to cart" popup, shown over Firework's player after Add to cart (see src/cart/sheet.ts). Registered as its
 * own root component in index.js, so it needs its own SafeAreaProvider.
 */
export function CartSheet() {
  return (
    <SafeAreaProvider>
      <Sheet />
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'transparent' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(20,33,43,0.45)' },
  sheet: { backgroundColor: colors.white, borderTopLeftRadius: 18, borderTopRightRadius: 18, paddingHorizontal: 16, paddingTop: 8 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.mist, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '700', color: colors.ink, marginBottom: 12 },
  added: { flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 14 },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: colors.paper },
  name: { fontSize: 16, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 14, color: colors.inkSoft, marginTop: 2 },
  was: { textDecorationLine: 'line-through' },
  cart: { backgroundColor: colors.paper, borderRadius: 12, padding: 12, marginBottom: 16 },
  cartHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  cartTitle: { fontSize: 14, fontWeight: '700', color: colors.ink },
  cartTotal: { fontSize: 14, fontWeight: '700', color: colors.ink },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginTop: 4 },
  rowName: { flex: 1, fontSize: 13, color: colors.inkSoft },
  rowPrice: { fontSize: 13, color: colors.inkSoft },
  more: { fontSize: 13, color: colors.inkSoft, marginTop: 4 },
  actions: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  btnSecondary: { backgroundColor: colors.white, borderWidth: 1, borderColor: colors.mist },
  btnPrimary: { backgroundColor: colors.fjord },
  btnBusy: { opacity: 0.6 },
  btnText: { fontSize: 16, fontWeight: '700' },
  btnSecondaryText: { color: colors.ink },
  btnPrimaryText: { color: colors.white },
});
