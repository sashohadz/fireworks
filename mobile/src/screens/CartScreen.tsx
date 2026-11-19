import React, { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { cartCount, cartSubtotal, getCart, onCart, setQuantity, type CartLine } from '../cart/cart';
import { placeOrder, type Order } from '../cart/checkout';
import { Intro } from '../components/Notice';
import { colors } from '../config';

const euro = (n: number) => `€${n.toFixed(2)}`;

/**
 * One cart line. The quantity buttons sit on the left: Firework's floating player (after the cart icon) parks on the
 * right side of the screen and would cover them there.
 */
function Line({ l }: { l: CartLine }) {
  return (
    <View style={s.line}>
      <Text style={s.name}>{l.name}</Text>
      <Text style={s.meta}>
        {l.unitName} · {l.unitId}
      </Text>
      <View style={s.lineRow}>
        <View style={s.qty}>
          <Pressable onPress={() => setQuantity(l.unitId, l.quantity - 1)} style={s.qtyBtn} accessibilityRole="button" accessibilityLabel={`One less ${l.name}`} hitSlop={8}>
            <Text style={s.qtyBtnText}>−</Text>
          </Pressable>
          <Text style={s.qtyText}>{l.quantity}</Text>
          <Pressable
            onPress={() => setQuantity(l.unitId, l.quantity + 1)}
            disabled={l.quantity >= l.stock}
            style={[s.qtyBtn, l.quantity >= l.stock && s.qtyBtnOff]}
            accessibilityRole="button"
            accessibilityLabel={`One more ${l.name}`}
            hitSlop={8}
          >
            <Text style={s.qtyBtnText}>+</Text>
          </Pressable>
        </View>
        <Text style={s.price}>
          {euro(l.price)}
          {l.regularPrice > l.price ? <Text style={s.was}>  {euro(l.regularPrice)}</Text> : null}
        </Text>
      </View>
    </View>
  );
}

/** Page 3: the app's own cart. Items added in Firework's player land here; checkout reports the order to Firework. */
export function CartScreen() {
  const [lines, setLines] = useState(getCart());
  const [order, setOrder] = useState<Order | undefined>();
  const [busy, setBusy] = useState(false);
  useEffect(() => onCart(setLines), []);

  const checkout = async () => {
    setBusy(true);
    try {
      setOrder(await placeOrder());
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Intro title="Cart">The app’s own cart. “Add to cart” in a Firework video lands here, and the player’s cart icon opens this page.</Intro>
      {order && !lines.length ? (
        <View style={s.done}>
          <Text style={s.doneTitle}>Order placed</Text>
          <Text style={s.doneText}>
            {order.id} · {order.items} item{order.items === 1 ? '' : 's'} · {euro(order.total)}
          </Text>
          <Text style={s.doneText}>Firework has been told (trackPurchase), so it can link the sale to the videos you watched. See Log.</Text>
        </View>
      ) : null}
      <FlatList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 16 }}
        data={lines}
        keyExtractor={(l) => l.unitId}
        renderItem={({ item }) => <Line l={item} />}
        ListEmptyComponent={!order ? <Text style={s.empty}>Your cart is empty. Open a video, tap a product and “Add to cart”.</Text> : null}
      />
      {lines.length ? (
        <View style={s.footer}>
          <View style={s.totalRow}>
            <Text style={s.totalLabel}>
              Subtotal · {cartCount(lines)} item{cartCount(lines) === 1 ? '' : 's'}
            </Text>
            <Text style={s.total}>{euro(cartSubtotal(lines))}</Text>
          </View>
          <Pressable onPress={checkout} disabled={busy} style={[s.checkout, busy && { opacity: 0.6 }]} accessibilityRole="button">
            <Text style={s.checkoutText}>{busy ? 'Placing order…' : 'Check out (demo)'}</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  line: { paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.mist },
  lineRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 8 },
  name: { fontSize: 15, fontWeight: '600', color: colors.ink },
  meta: { fontSize: 12, color: colors.inkSoft, marginTop: 2 },
  price: { fontSize: 15, fontWeight: '700', color: colors.ink },
  was: { fontSize: 13, fontWeight: '400', color: colors.inkSoft, textDecorationLine: 'line-through' },
  qty: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  qtyBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: colors.mist, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  qtyBtnText: { fontSize: 18, color: colors.ink, fontWeight: '600' },
  qtyBtnOff: { opacity: 0.35 },
  qtyText: { minWidth: 18, textAlign: 'center', fontSize: 15, fontWeight: '600', color: colors.ink },
  empty: { color: colors.inkSoft, fontSize: 14, lineHeight: 20, paddingVertical: 16 },
  footer: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, borderColor: colors.mist, backgroundColor: colors.white },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  totalLabel: { fontSize: 15, color: colors.inkSoft },
  total: { fontSize: 17, fontWeight: '700', color: colors.ink },
  checkout: { backgroundColor: colors.fjord, borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  checkoutText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  done: { marginHorizontal: 16, marginBottom: 8, padding: 14, borderRadius: 10, backgroundColor: colors.mist },
  doneTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  doneText: { fontSize: 13, color: colors.ink, marginTop: 4, lineHeight: 18 },
});
